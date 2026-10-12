/**
 * Conversation gaps across sessions: what the learner could not say, kept until they say it
 * without help on another day. Experimental and separate from the tutor's evidence system — a gap
 * never feeds skill evidence, the agenda or the catalog.
 *
 * Lifecycle: a review opens a gap; the same `patternLabel` found again counts as a recurrence (or
 * reopens a closed gap, history preserved); using the natural form unaided in a session at least
 * 24h after the gap opened closes it.
 */

import { containsExpression } from "./repertoire";
import { newExpressionBudget, type ExpressionPacing } from "./longSession";
import type { GapKind, ReviewedGap } from "./gapReview";

export const MAX_OPEN_GAPS = 9;
export const GAP_CLOSE_DELAY_MS = 24 * 60 * 60 * 1000;
/** The partner steers toward one gap at most this many times per session, then lets it go. */
export const GAP_PULLS_PER_SESSION = 2;
/** "Without help": the partner did not say the form in its last this-many turns. */
export const UNAIDED_AI_TURNS = 2;

export interface GapEvent {
  type: "opened" | "recurred" | "closed" | "reopened";
  at: number;
  sessionId: string;
  /** The learner's words at that moment: the stuck stretch, or the unaided use that closed it. */
  evidence?: string;
}

export interface ConversationGap {
  id: string;
  patternLabel: string;
  kind: GapKind;
  /** Latest real words that showed the gap. Never empty: no gap is shown without them. */
  evidence: string;
  askedIn?: string;
  intent: string;
  natural: ReviewedGap["natural"];
  why: string;
  functionId?: string;
  scenarioId?: string;
  originSessionId: string;
  sessionIds: string[];
  /** Sessions in which this pattern showed up, reopenings included. */
  occurrences: number;
  status: "open" | "closed";
  firstOpenedAt: number;
  /** Start of the current open period; the 24h rule counts from here. */
  openedAt: number;
  closedAt?: number;
  closedInSessionId?: string;
  reopenCount: number;
  updatedAt: number;
  history: GapEvent[];
}

export interface GapSession {
  id: string;
  startedAt: number;
  scenarioId?: string;
}

/**
 * Fold a review's gaps into the registry. Returns only the records that changed or were created.
 * Idempotent per session: re-running a review never counts the same session twice.
 */
export function recordReviewedGaps(
  existing: ConversationGap[],
  reviewed: ReviewedGap[],
  session: GapSession,
  at: number,
  newId: () => string = () => crypto.randomUUID(),
): ConversationGap[] {
  const byLabel = new Map(existing.map((gap) => [gap.patternLabel, gap]));
  const changed = new Map<string, ConversationGap>();
  for (const item of reviewed) {
    const current = changed.get(item.patternLabel) ?? byLabel.get(item.patternLabel);
    const fresh = {
      kind: item.kind,
      evidence: item.evidence,
      askedIn: item.askedIn,
      intent: item.intent,
      natural: item.natural,
      why: item.why,
      functionId: item.functionId,
    };
    if (!current) {
      changed.set(item.patternLabel, {
        id: newId(),
        patternLabel: item.patternLabel,
        ...fresh,
        scenarioId: session.scenarioId,
        originSessionId: session.id,
        sessionIds: [session.id],
        occurrences: 1,
        status: "open",
        firstOpenedAt: at,
        openedAt: at,
        reopenCount: 0,
        updatedAt: at,
        history: [{ type: "opened", at, sessionId: session.id, evidence: item.evidence }],
      });
      continue;
    }
    if (current.sessionIds.includes(session.id)) continue;
    const reopening = current.status === "closed";
    changed.set(item.patternLabel, {
      ...current,
      ...fresh,
      scenarioId: session.scenarioId ?? current.scenarioId,
      sessionIds: [...current.sessionIds, session.id],
      occurrences: current.occurrences + 1,
      status: "open",
      openedAt: reopening ? at : current.openedAt,
      closedAt: undefined,
      closedInSessionId: undefined,
      reopenCount: current.reopenCount + (reopening ? 1 : 0),
      updatedAt: at,
      history: [...current.history, { type: reopening ? "reopened" : "recurred", at, sessionId: session.id, evidence: item.evidence }],
    });
  }
  return [...changed.values()];
}

/** Newest 9 open gaps are active; older open gaps stay frozen (never pulled) until room opens. */
export function partitionOpenGaps(gaps: ConversationGap[]): { active: ConversationGap[]; frozen: ConversationGap[] } {
  const open = gaps.filter((gap) => gap.status === "open").sort((a, b) => b.openedAt - a.openedAt || a.id.localeCompare(b.id));
  return { active: open.slice(0, MAX_OPEN_GAPS), frozen: open.slice(MAX_OPEN_GAPS) };
}

/** Recurring patterns are recognized by label, open or closed. */
export function knownPatternLabels(gaps: ConversationGap[]): string[] {
  return [...new Set(gaps.map((gap) => gap.patternLabel))];
}

function closableIn(gap: ConversationGap, session: GapSession): boolean {
  return gap.status === "open" && session.startedAt - gap.openedAt >= GAP_CLOSE_DELAY_MS && !gap.sessionIds.includes(session.id);
}

/** The forms whose use counts: the short core when the review gave one, else both versions. */
export function gapForms(gap: Pick<ConversationGap, "natural">): string[] {
  return gap.natural.key ? [gap.natural.key] : [gap.natural.casual, gap.natural.neutral];
}

/**
 * Gaps the partner should steer toward now, most overdue first: active (not frozen), old enough
 * to close in this session, and not already pulled twice or closed here.
 */
export function pullableGaps(
  gaps: ConversationGap[],
  session: GapSession,
  pulls: Record<string, number> = {},
  closedHere: string[] = [],
): ConversationGap[] {
  return partitionOpenGaps(gaps).active
    .filter((gap) => closableIn(gap, session) && (pulls[gap.id] ?? 0) < GAP_PULLS_PER_SESSION && !closedHere.includes(gap.id))
    .sort((a, b) => a.openedAt - b.openedAt);
}

/**
 * Gaps a learner turn closes. The use must be the learner's own: not in the review's
 * reconstruction, and not right after the partner said the form itself in either of its last two
 * turns. Spontaneous use counts the same as use after the partner steered toward it.
 */
export function gapsClosedByTurn(input: {
  text: string;
  gaps: ConversationGap[];
  session: GapSession;
  /** The partner's turns before this one, oldest first. */
  previousAiTurns: string[];
}): ConversationGap[] {
  const recentAi = input.previousAiTurns.slice(-UNAIDED_AI_TURNS);
  return input.gaps.filter((gap) => {
    if (!closableIn(gap, input.session)) return false;
    const used = gapForms(gap).some((form) => containsExpression(input.text, form));
    if (!used) return false;
    return !recentAi.some((turn) => gapForms(gap).some((form) => containsExpression(turn, form)));
  });
}

export function closeGap(gap: ConversationGap, session: GapSession, at: number, evidence: string): ConversationGap {
  return {
    ...gap,
    status: "closed",
    closedAt: at,
    closedInSessionId: session.id,
    updatedAt: at,
    history: [...gap.history, { type: "closed", at, sessionId: session.id, evidence }],
  };
}

export function isConversationGap(value: unknown): value is ConversationGap {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const natural = v.natural as Record<string, unknown> | undefined;
  return typeof v.id === "string" && typeof v.patternLabel === "string" && v.patternLabel.length > 0
    && typeof v.evidence === "string" && v.evidence.trim().length > 0
    && typeof v.intent === "string"
    && typeof natural === "object" && natural !== null && typeof natural.casual === "string" && typeof natural.neutral === "string"
    && (v.status === "open" || v.status === "closed")
    && typeof v.openedAt === "number" && typeof v.firstOpenedAt === "number"
    && Array.isArray(v.sessionIds) && Array.isArray(v.history);
}

/**
 * What the next partner turn brings, in priority order: an open gap to steer toward first; only
 * when none is pending, at B1/B2, new expressions within the session's pacing. C1/C2 keep the
 * existing repertoire mode, so no budget is handed out here.
 */
export function planNextTurn(input: {
  gaps: ConversationGap[];
  session: GapSession;
  pulls?: Record<string, number>;
  closedHere?: string[];
  nextAiTurn: number;
  pacing: ExpressionPacing;
  level?: string;
}): { gap?: ConversationGap; newExpressionBudget: number } {
  const gap = pullableGaps(input.gaps, input.session, input.pulls, input.closedHere)[0];
  const cefr = input.level?.trim().toUpperCase();
  const intermediate = cefr === "B1" || cefr === "B2";
  return {
    gap,
    newExpressionBudget: intermediate ? newExpressionBudget({ nextAiTurn: input.nextAiTurn, pacing: input.pacing, gapPending: Boolean(gap) }) : 0,
  };
}
