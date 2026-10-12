import { describe, expect, it } from "vitest";
import type { Conversation } from "@/lib/store/repository";
import { longSessionMetrics } from "./longSessionMetrics";
import { closeGap, GAP_CLOSE_DELAY_MS, recordReviewedGaps, type ConversationGap } from "./gaps";
import type { ReviewedGap } from "./gapReview";

const DAY = GAP_CLOSE_DELAY_MS;

function session(id: string, startedAt: number, turns: Conversation["turns"], extra: Partial<NonNullable<Conversation["longSession"]>> = {}): Conversation {
  return {
    id, scenario: "Daily", context: "daily", targetLang: "en", sourceLang: "pt", level: "B1", startedAt, endedAt: startedAt + 600_000, mode: "long", turns,
    longSession: { durationMinutes: 10, activeMs: 600_000, pacing: { introduced: 0 }, endedBy: "time", ...extra },
  };
}

const stuck = (text: string, input: "voice" | "typed", durationMs?: number) => ({ role: "user" as const, text, codeSwitch: true, codeSwitchInput: input, durationMs });

function gap(label: string, at: number, sessionId: string): ConversationGap {
  const reviewed: ReviewedGap = { kind: "code_switch", evidence: `evidência ${label}`, intent: "x", natural: { casual: "a", neutral: "b" }, why: "", patternLabel: label, severity: "medium" };
  return recordReviewedGaps([], [reviewed], { id: sessionId, startedAt: at }, at, () => `gap-${label}`)[0];
}

describe("long session metrics for the 2-week evaluation", () => {
  const history = [
    session("s1", 0, [{ role: "assistant", text: "Hi" }, stuck("eu travei aqui", "voice", 4_000), stuck("prazo", "typed"), { role: "user", text: "ok" }]),
    session("s2", 2 * DAY, [{ role: "user", text: "We should push it back." }, stuck("adiar", "voice", 2_000)], { closedGapIds: ["gap-a"] }),
    session("s3", 9 * DAY, [{ role: "user", text: "Fine." }]),
    session("silent", 10 * DAY, [{ role: "assistant", text: "Hello?" }]),
  ];
  const gaps = [
    closeGap(gap("a", 0, "s1"), { id: "s2", startedAt: 2 * DAY }, 2 * DAY, "We should push it back."), // closed
    gap("b", 0, "s1"), // open, had s2 and s3 later → eligible, not closed
    gap("c", 8.5 * DAY, "s3"), // only s3 started 0.5 day later → not eligible yet
  ];

  it("derives the share of closed gaps over gaps that had a chance to close", () => {
    const report = longSessionMetrics(history, gaps, 12 * DAY);
    expect(report.gaps).toMatchObject({ total: 3, eligible: 2, closed: 1, closedShare: 0.5, notYetEligible: 1, open: 2 });
  });

  it("reports Portuguese per session as recorded seconds next to stuck moments", () => {
    const report = longSessionMetrics(history, gaps, 12 * DAY);
    expect(report.portuguesePerSession).toEqual([
      { startedAt: 0, recordedSeconds: 4, stuckMoments: 2 },
      { startedAt: 2 * DAY, recordedSeconds: 2, stuckMoments: 1 },
      { startedAt: 9 * DAY, recordedSeconds: 0, stuckMoments: 0 },
    ]);
  });

  it("counts long sessions per 7-day window, ignoring sessions where the learner never spoke", () => {
    const report = longSessionMetrics(history, gaps, 12 * DAY);
    expect(report.sessionsPerWeek.map((week) => [week.sessions, week.complete])).toEqual([[2, true], [1, false]]);
    expect(report.sessions.map((row) => row.id)).toEqual(["s1", "s2", "s3"]);
  });

  it("states they are process measures and carries no text unless answers are included", () => {
    const report = longSessionMetrics(history, gaps, 12 * DAY);
    expect(report.measures).toContain("not proficiency");
    expect(JSON.stringify(report)).not.toContain("eu travei aqui");
    expect(JSON.stringify(report)).not.toContain("evidência");
    expect(longSessionMetrics(history, gaps, 12 * DAY, true).gapEvidence).toHaveLength(3);
  });

  it("has no share before any gap could close", () => {
    expect(longSessionMetrics([], [], 0).gaps.closedShare).toBeNull();
  });
});
