/**
 * Long conversation session (experimental, B1+). The session is measured in minutes, not in
 * turns: the learner keeps talking until the timer runs out, gets stuck on purpose, and the
 * review turns what they could not say into gaps that come back on another day.
 *
 * Everything here is pure so the timer, the "travei" metrics and the expression pacing can be
 * tested without a browser.
 */

import type { ConversationTurn } from "@/lib/cards/provider";

export const LONG_SESSION_DURATIONS = [5, 10] as const;
export type LongSessionDuration = (typeof LONG_SESSION_DURATIONS)[number];

const MINUTE = 60_000;

/** B1 and above: below that the learner needs the guided, turn-limited conversation. */
export function isLongSessionLevel(level?: string): boolean {
  const cefr = level?.trim().toUpperCase();
  return cefr === "B1" || cefr === "B2" || cefr === "C1" || cefr === "C2";
}

/**
 * Pause-aware clock. `activeMs` is time already spent in earlier runs; `runningSince` is set
 * only while the clock runs. Pausing folds the current run into `activeMs`.
 */
export interface LongSessionClock {
  durationMinutes: LongSessionDuration;
  activeMs: number;
  runningSince?: number;
}

export function startClock(durationMinutes: LongSessionDuration, now: number): LongSessionClock {
  return { durationMinutes, activeMs: 0, runningSince: now };
}

export function elapsedMs(clock: LongSessionClock, now: number): number {
  return clock.activeMs + (clock.runningSince === undefined ? 0 : Math.max(0, now - clock.runningSince));
}

export function remainingMs(clock: LongSessionClock, now: number): number {
  return Math.max(0, clock.durationMinutes * MINUTE - elapsedMs(clock, now));
}

export function isTimeUp(clock: LongSessionClock, now: number): boolean {
  return remainingMs(clock, now) === 0;
}

/** Generic so the rest of a stored record (pacing, scenario…) survives the pause untouched. */
export function pauseClock<T extends LongSessionClock>(clock: T, now: number): T {
  if (clock.runningSince === undefined) return clock;
  const paused = { ...clock, activeMs: elapsedMs(clock, now) };
  delete paused.runningSince;
  return paused;
}

export function resumeClock<T extends LongSessionClock>(clock: T, now: number): T {
  return clock.runningSince === undefined ? { ...clock, runningSince: now } : clock;
}

/** "4:07" — what the visible timer shows. */
export function formatRemaining(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * When the time runs out the current turn is allowed to finish: a learner mid-sentence keeps
 * the floor, and the session moves to review once that turn is in (without another AI reply).
 */
export function timeUpAction(input: { timeUp: boolean; turnInProgress: boolean }): "continue" | "wait_for_turn" | "review" {
  if (!input.timeUp) return "continue";
  return input.turnInProgress ? "wait_for_turn" : "review";
}

/** A session where the learner never spoke ends without a review: there is nothing to review. */
export function endDisposition(turns: ConversationTurn[]): "review" | "discard" {
  return turns.some((turn) => turn.role === "user" && turn.text.trim()) ? "review" : "discard";
}

/* ─────────────────────────── "travei": Portuguese stretches ─────────────────────────── */

/**
 * Per session: how many times the learner got stuck and switched to Portuguese (button or typed),
 * and the seconds of recorded Portuguese. A typed stretch has no duration, so it counts as a
 * stuck moment but adds nothing to the seconds.
 */
export function codeSwitchStats(turns: ConversationTurn[]): { count: number; recordedSeconds: number; typed: number } {
  const switches = turns.filter((turn) => turn.role === "user" && turn.codeSwitch);
  const recordedMs = switches.reduce((sum, turn) => sum + (turn.codeSwitchInput === "voice" ? turn.durationMs ?? 0 : 0), 0);
  return {
    count: switches.length,
    recordedSeconds: Math.round(recordedMs / 1000),
    typed: switches.filter((turn) => turn.codeSwitchInput === "typed").length,
  };
}

/** The Portuguese the partner should answer with an English form, when the last turn was a "travei". */
export function pendingCodeSwitch(turns: ConversationTurn[]): string | undefined {
  const last = turns.at(-1);
  return last?.role === "user" && last.codeSwitch ? last.text : undefined;
}

/* ─────────────────────────── new expressions at B1/B2 ─────────────────────────── */

/** At most 2 new expressions in one window of AI turns, and at most 3 in the whole session. */
export const NEW_EXPRESSIONS_PER_WINDOW = 2;
export const NEW_EXPRESSIONS_PER_SESSION = 3;
/** AI turns between two turns that introduce expressions ("2 a cada 4–5 falas"). */
export const NEW_EXPRESSION_WINDOW = 4;

export interface ExpressionPacing {
  /** Expressions introduced so far in this session. */
  introduced: number;
  /** Index (0-based, among AI turns) of the last AI turn that introduced any. */
  lastIntroAiTurn?: number;
}

/**
 * How many new expressions the next AI turn may introduce. Zero on the opening turn, while a gap
 * is waiting to be pulled (gaps come first), and until a full window has passed since the last
 * introduction.
 */
export function newExpressionBudget(input: { nextAiTurn: number; pacing: ExpressionPacing; gapPending: boolean }): number {
  if (input.gapPending || input.nextAiTurn === 0) return 0;
  const left = NEW_EXPRESSIONS_PER_SESSION - input.pacing.introduced;
  if (left <= 0) return 0;
  const last = input.pacing.lastIntroAiTurn;
  if (last !== undefined && input.nextAiTurn - last < NEW_EXPRESSION_WINDOW) return 0;
  return Math.min(NEW_EXPRESSIONS_PER_WINDOW, left);
}

/** Record what an AI turn actually introduced, never counting past the allowed budget. */
export function recordIntroduced(pacing: ExpressionPacing, aiTurn: number, introduced: number, budget: number): ExpressionPacing {
  const counted = Math.min(introduced, budget);
  if (counted <= 0) return pacing;
  return { introduced: pacing.introduced + counted, lastIntroAiTurn: aiTurn };
}

export function aiTurnCount(turns: ConversationTurn[]): number {
  return turns.filter((turn) => turn.role === "assistant").length;
}

/** What a long session stores on its conversation record, next to the turns. */
export interface LongSessionRecord extends LongSessionClock {
  /** Domain-profile scenario the session started from; absent for a free topic. */
  scenarioId?: string;
  profileId?: string;
  /** Learner-facing scenario label, so the review header reads like the setup did. */
  label?: string;
  endedBy?: "time" | "learner";
  pacing: ExpressionPacing;
}

/** A topic offered at setup: a domain-profile scenario, already localized for the learner. */
export interface LongSessionTopic {
  id: string;
  profileId?: string;
  label: string;
  situation: string;
  aiRole?: string;
  /** What the learner has to do with the language here; fed to the prompt. */
  functions?: { id: string; label: string }[];
  /** Domain expressions the partner may introduce at B1/B2. */
  expressions?: string[];
}

/** Shortest held-button clip worth transcribing; anything shorter was a tap, not speech. */
export const MIN_CODE_SWITCH_MS = 400;

/**
 * The learner turn a "travei" produces: their Portuguese, marked, with when it was said and — for
 * a recording only — how long it ran.
 */
export function codeSwitchTurn(text: string, input: "voice" | "typed", at: number, durationMs?: number): ConversationTurn {
  return {
    role: "user",
    text: text.trim(),
    codeSwitch: true,
    codeSwitchInput: input,
    at,
    ...(input === "voice" && durationMs !== undefined ? { durationMs: Math.max(0, Math.round(durationMs)), spoken: true } : {}),
  };
}
