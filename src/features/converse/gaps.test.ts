import { describe, expect, it } from "vitest";
import type { ReviewedGap } from "./gapReview";
import {
  closeGap,
  GAP_CLOSE_DELAY_MS,
  gapsClosedByTurn,
  isConversationGap,
  knownPatternLabels,
  MAX_OPEN_GAPS,
  partitionOpenGaps,
  planNextTurn,
  pullableGaps,
  recordReviewedGaps,
  type ConversationGap,
} from "./gaps";

const DAY = GAP_CLOSE_DELAY_MS;
let ids = 0;
const newId = () => `gap-${++ids}`;

function reviewed(overrides: Partial<ReviewedGap> = {}): ReviewedGap {
  return {
    kind: "code_switch",
    evidence: "a gente precisa adiar o deploy",
    intent: "adiar o deploy",
    natural: { casual: "Let's push the deploy back", neutral: "We need to postpone the deployment", key: "push the deploy back" },
    why: "Natural em reunião.",
    patternLabel: "postpone-delivery",
    severity: "high",
    ...overrides,
  };
}

function openGap(at = 0, overrides: Partial<ReviewedGap> = {}): ConversationGap {
  return recordReviewedGaps([], [reviewed(overrides)], { id: `s-${at}`, startedAt: at }, at, newId)[0];
}

describe("opening, recurrence and reopening", () => {
  it("opens a gap from a review with its real words and origin", () => {
    const gap = openGap(100);
    expect(gap).toMatchObject({ status: "open", openedAt: 100, firstOpenedAt: 100, occurrences: 1, originSessionId: "s-100", evidence: "a gente precisa adiar o deploy" });
    expect(gap.history).toEqual([{ type: "opened", at: 100, sessionId: "s-100", evidence: "a gente precisa adiar o deploy" }]);
    expect(isConversationGap(gap)).toBe(true);
  });

  it("counts the same pattern in a later session as a recurrence, once per session", () => {
    const gap = openGap(0);
    const [again] = recordReviewedGaps([gap], [reviewed({ evidence: "I don't know how to say delay" })], { id: "s-2", startedAt: DAY }, DAY, newId);
    expect(again).toMatchObject({ id: gap.id, occurrences: 2, openedAt: 0, evidence: "I don't know how to say delay", sessionIds: ["s-0", "s-2"] });
    expect(recordReviewedGaps([again], [reviewed()], { id: "s-2", startedAt: DAY }, DAY + 5, newId)).toEqual([]);
    expect(knownPatternLabels([again])).toEqual(["postpone-delivery"]);
  });

  it("reopens a closed gap when the learner gets stuck on it again, keeping its history", () => {
    const closed = closeGap(openGap(0), { id: "s-close", startedAt: 2 * DAY }, 2 * DAY + 10, "we should push the deploy back");
    const [reopened] = recordReviewedGaps([closed], [reviewed()], { id: "s-later", startedAt: 5 * DAY }, 5 * DAY, newId);
    expect(reopened).toMatchObject({ status: "open", openedAt: 5 * DAY, firstOpenedAt: 0, reopenCount: 1, occurrences: 2, closedAt: undefined });
    expect(reopened.history.map((event) => event.type)).toEqual(["opened", "closed", "reopened"]);
  });
});

describe("closing", () => {
  const gap = openGap(0);
  const later = { id: "later", startedAt: DAY + 1 };

  it("closes on unaided use of the natural form in a session at least 24h later", () => {
    expect(gapsClosedByTurn({ text: "Honestly we should push the deploy back a week.", gaps: [gap], session: later, previousAiTurns: ["How is the release going?"] })).toEqual([gap]);
  });

  it("closes on spontaneous use too, without the partner having steered toward it", () => {
    expect(gapsClosedByTurn({ text: "Can we push the deploy back?", gaps: [gap], session: later, previousAiTurns: [] })).toHaveLength(1);
  });

  it("does not close before 24h, or in the session that opened it", () => {
    expect(gapsClosedByTurn({ text: "push the deploy back", gaps: [gap], session: { id: "soon", startedAt: DAY - 1 }, previousAiTurns: [] })).toEqual([]);
    const fresh = openGap(10 * DAY);
    expect(gapsClosedByTurn({ text: "push the deploy back", gaps: [fresh], session: { id: fresh.originSessionId, startedAt: 12 * DAY }, previousAiTurns: [] })).toEqual([]);
  });

  it("does not count as unaided when the partner said the form in one of its last 2 turns", () => {
    const helped = (turns: string[]) => gapsClosedByTurn({ text: "Yes, push the deploy back.", gaps: [gap], session: later, previousAiTurns: turns });
    expect(helped(["Should we push the deploy back?", "Okay."])).toEqual([]);
    expect(helped(["Should we push the deploy back?"])).toEqual([]);
    expect(helped(["Should we push the deploy back?", "Hm.", "What do you think?"])).toHaveLength(1);
  });

  it("matches inflected use of the short core", () => {
    expect(gapsClosedByTurn({ text: "I pushed the deploy back yesterday", gaps: [gap], session: later, previousAiTurns: [] })).toHaveLength(1);
  });
});

describe("at most 9 open gaps", () => {
  const many = Array.from({ length: MAX_OPEN_GAPS + 2 }, (_, index) => openGap(index * 1000, { patternLabel: `pattern-${index}` }));

  it("freezes the oldest above 9 and never pulls them", () => {
    const { active, frozen } = partitionOpenGaps(many);
    expect(active).toHaveLength(MAX_OPEN_GAPS);
    expect(frozen.map((gap) => gap.patternLabel)).toEqual(["pattern-1", "pattern-0"]);
    const pulled = pullableGaps(many, { id: "x", startedAt: 30 * DAY });
    expect(pulled).toHaveLength(MAX_OPEN_GAPS);
    expect(pulled.map((gap) => gap.patternLabel)).not.toContain("pattern-0");
    expect(pulled[0].patternLabel).toBe("pattern-2");
  });

  it("thaws a frozen gap once an active one closes", () => {
    const closedNewest = many.map((gap) => (gap.patternLabel === "pattern-10" ? closeGap(gap, { id: "c", startedAt: 30 * DAY }, 30 * DAY, "x") : gap));
    expect(partitionOpenGaps(closedNewest).frozen.map((gap) => gap.patternLabel)).toEqual(["pattern-0"]);
  });
});

describe("what the partner brings next", () => {
  const gap = openGap(0);
  const session = { id: "s", startedAt: 2 * DAY };
  const pacing = { introduced: 0 };

  it("pulls an open gap before any new expression at B1/B2", () => {
    expect(planNextTurn({ gaps: [gap], session, nextAiTurn: 3, pacing, level: "B1" })).toEqual({ gap, newExpressionBudget: 0 });
  });

  it("lets a gap go after two pulls, then allows new expressions", () => {
    expect(planNextTurn({ gaps: [gap], session, pulls: { [gap.id]: 2 }, nextAiTurn: 3, pacing, level: "B2" })).toEqual({ gap: undefined, newExpressionBudget: 2 });
    expect(planNextTurn({ gaps: [gap], session, closedHere: [gap.id], nextAiTurn: 3, pacing, level: "B2" }).gap).toBeUndefined();
  });

  it("does not pull a gap too young to close", () => {
    expect(planNextTurn({ gaps: [gap], session: { id: "s", startedAt: DAY - 1 }, nextAiTurn: 3, pacing, level: "B1" }).gap).toBeUndefined();
  });

  it("keeps C1/C2 on the existing repertoire mode", () => {
    expect(planNextTurn({ gaps: [], session, nextAiTurn: 3, pacing, level: "C1" }).newExpressionBudget).toBe(0);
  });
});
