import { describe, expect, it } from "vitest";
import type { Card } from "@/lib/cards/schema";
import type { ProductionAttempt, RetryOutcome } from "@/lib/performance/types";
import type { ReviewRecord } from "@/lib/store/repository";
import { deriveLearningEvidence, type LearningEvidenceInput } from "./learningEvidence";
import { LOCAL_JUDGE } from "@/lib/evaluation/judge";

const now = new Date(2026, 8, 29, 12).getTime();
const day = 86_400_000;
const card: Card = { id: "a", front: "Eu trabalho aqui.", back: "I work here.", concept: "work", direction: "production", source: { kind: "phrase", id: "a" }, createdAt: now - 40 * day };
const empty: LearningEvidenceInput = { cards: [card], reviews: [], production: [], retries: [], proofs: [], listening: [] };
function review(overrides: Partial<ReviewRecord> = {}): ReviewRecord {
  return { id: "r", cardId: "a", concept: "work", direction: "production", grade: 3, previousState: 2,
    scheduledDays: 1, reviewedAt: now, responseText: "I work here.", responseCorrect: true, ...overrides };
}
function production(overrides: Partial<ProductionAttempt> = {}): ProductionAttempt {
  return { id: "p", text: "I work here.", source: "study", stage: "production", spoken: false,
    wordCount: 3, finished: true, evaluated: true, taskCompleted: true, issueCount: 0, createdAt: now, ...overrides };
}
function retry(overrides: Partial<RetryOutcome> = {}): RetryOutcome {
  return { id: "retry", retryOf: "p", source: "correct", text: "I work here.", spoken: false,
    wordCount: 3, resolved: true, issueCount: 0, createdAt: now, ...overrides };
}

describe("learning evidence", () => {
  it("shows unknown rather than zero for unmeasured learning", () => {
    const evidence = deriveLearningEvidence(empty, now);
    expect(evidence.recall.percent).toBeNull();
    expect(evidence.retention.percent).toBeNull();
    expect(evidence.transfer.percent).toBeNull();
    expect(evidence.wins).toEqual([]);
  });
  it("never turns a self grade, hint, recognition answer, or empty response into independent recall", () => {
    for (const overrides of [{ responseCorrect: undefined }, { hintUsed: true }, { scaffoldLevel: 2 }, { direction: "recognition" as const }, { responseText: " " }]) {
      const evidence = deriveLearningEvidence({ ...empty, reviews: [review(overrides)] }, now);
      expect(evidence.recall.total).toBe(0);
      expect(evidence.wins).toEqual([]);
    }
  });
  it("shows a real pre-reveal answer and measures the gap from the immediately preceding review", () => {
    const evidence = deriveLearningEvidence({ ...empty, reviews: [review(), review({ id: "old", reviewedAt: now - 7 * day }), review({ id: "intervening", reviewedAt: now - 2 * day })] }, now);
    expect(evidence.wins[0]).toMatchObject({ kind: "recall", text: "I work here.", days: 2 });
  });
  it("does not keep a success example after a newer miss or a deleted card", () => {
    expect(deriveLearningEvidence({ ...empty, reviews: [review({ id: "old", reviewedAt: now - day }), review({ responseCorrect: false })] }, now).wins).toEqual([]);
    expect(deriveLearningEvidence({ ...empty, cards: [], reviews: [review()] }, now).wins).toEqual([]);
  });
  it("shows before and after only for a linked, improved retry", () => {
    const input = { ...empty, production: [production({ text: "I works here.", issueCount: 1, createdAt: now - 1000 })], retries: [retry()] };
    expect(deriveLearningEvidence(input, now).wins[0]).toMatchObject({ kind: "retry", before: "I works here.", text: "I work here." });
    for (const overrides of [{ resolved: false }, { resolution: "dismissed" as const }, { retryOf: "missing" }, { issueCount: 1 }, { skipped: true }, { text: "I works here." }]) {
      expect(deriveLearningEvidence({ ...input, retries: [retry(overrides)] }, now).wins).toEqual([]);
    }
  });
  it("counts only verified, unaided uses in new content as transfer successes", () => {
    const success = production({ transferKind: "phrase_to_situation", transferVerified: true, newContext: true });
    expect(deriveLearningEvidence({ ...empty, production: [success] }, now).transfer).toEqual({ total: 1, correct: 1, percent: 100 });
    for (const change of [{ evaluated: false }, { scaffoldUsed: true }, { skipped: true }]) {
      expect(deriveLearningEvidence({ ...empty, production: [{ ...success, ...change }] }, now).transfer.total).toBe(0);
    }
    const evidence = deriveLearningEvidence({ ...empty, production: [{ ...success, newContext: false }] }, now);
    expect(evidence.transfer.percent).toBe(0);
    expect(evidence.wins).toEqual([]);
  });
  it("does not compare different phrases or invent trends from tiny samples", () => {
    const evidence = deriveLearningEvidence({ ...empty, reviews: [review(), review({ id: "old", reviewedAt: now - 8 * day })] }, now);
    expect(evidence.comparison.delta).toBeNull();
  });
  it("compares the latest answer on shared phrases without inflating a trend with repeated easy items", () => {
    const shared = Array.from({ length: 5 }, (_, index) => `${index}`);
    const previous = shared.map((cardId) => review({ id: `old-${cardId}`, cardId, reviewedAt: now - 8 * day, judge: LOCAL_JUDGE, responseCorrect: false }));
    const current = shared.map((cardId) => review({ id: `new-${cardId}`, cardId, reviewedAt: now - day, judge: LOCAL_JUDGE, responseCorrect: cardId !== "4" }));
    const repetitions = Array.from({ length: 20 }, (_, index) => review({ id: `repeat-${index}`, cardId: "0", judge: LOCAL_JUDGE }));
    const evidence = deriveLearningEvidence({ ...empty, reviews: [...previous, ...current, ...repetitions] }, now);
    expect(evidence.comparison).toMatchObject({ cards: 5, delta: 80, current: { total: 5, percent: 80 }, previous: { total: 5, percent: 0 } });
    const changedInstrument = current.map((item) => ({ ...item, judge: { ...LOCAL_JUDGE, rulesVersion: "changed" } }));
    expect(deriveLearningEvidence({ ...empty, reviews: [...previous, ...changedInstrument] }, now).comparison.delta).toBeNull();
  });
  it("links a judged study retry without counting it as a fresh unaided transfer", () => {
    const first = production({ text: "I works here.", issueCount: 1, createdAt: now - 1000, judge: LOCAL_JUDGE });
    const second = production({ id: "retry", stage: "retry", retryOf: first.id, transferVerified: true, newContext: true, judge: LOCAL_JUDGE });
    const evidence = deriveLearningEvidence({ ...empty, production: [first, second] }, now);
    expect(evidence.wins).toEqual([expect.objectContaining({ kind: "retry", before: first.text, text: second.text, supported: true })]);
    expect(evidence.transfer.total).toBe(0);
    for (const change of [{ evaluated: false }, { issueCount: 1 }, { taskCompleted: false }, { judge: { ...LOCAL_JUDGE, rulesVersion: "changed" } }]) {
      expect(deriveLearningEvidence({ ...empty, production: [first, { ...second, ...change }] }, now).wins).toEqual([]);
    }
  });
  it("excludes future and old evidence from the 30-day display", () => {
    const evidence = deriveLearningEvidence({ ...empty, reviews: [review({ reviewedAt: now + day }), review({ reviewedAt: now - 31 * day })] }, now);
    expect(evidence.recall.total).toBe(0);
    expect(evidence.wins).toEqual([]);
  });
});
