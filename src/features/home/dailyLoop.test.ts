import { describe, expect, it } from "vitest";
import { deriveDailyLoop, reviewLimitFor } from "./dailyLoop";
import type { Card } from "@/lib/cards/schema";
import type { ReviewRecord } from "@/lib/store/repository";
import type { ProductionAttempt } from "@/lib/performance/types";

const now = new Date(2026, 8, 29, 12).getTime();
const card: Card = { id: "a", front: "A", back: "B", concept: "greeting", source: { kind: "phrase", id: "a" }, createdAt: now };
const input = { cards: [card], reviews: [] as ReviewRecord[], production: [] as ProductionAttempt[], due: 100, now };
const review = (id: string, reviewedAt = now): ReviewRecord => ({ id, cardId: id, grade: 3, concept: "greeting", scheduledDays: 1, previousState: 1, reviewedAt });
const attempt: ProductionAttempt = { id: "p", source: "study", text: "I work here.", spoken: false, wordCount: 3, finished: true, issueCount: 0, createdAt: now };

describe("daily learning loop", () => {
  it("gives a new learner a working lesson, not an empty review or setup wall", () => {
    expect(deriveDailyLoop({ ...input, cards: [], due: 0 }).next).toBe("lesson");
  });
  it("bounds overdue work and moves on to producing language", () => {
    expect(deriveDailyLoop(input).remaining).toBe(6);
    const reviewed = { ...input, reviews: Array.from({ length: 6 }, (_, i) => review(String(i))) };
    expect(deriveDailyLoop(reviewed).next).toBe("use");
    expect(deriveDailyLoop({ ...reviewed, production: [attempt] }).complete).toBe(true);
  });
  it("does not require adding new cards when no review is due", () => {
    expect(deriveDailyLoop({ ...input, due: 0 }).next).toBe("use");
  });
  it("keeps activity completion separate from evaluation", () => {
    expect(deriveDailyLoop({ ...input, due: 0, production: [{ ...attempt, evaluated: false }] }).complete).toBe(true);
  });
  it("ignores skipped, repeated, incomplete, and future productions", () => {
    for (const change of [{ skipped: true }, { stage: "repeat" as const }, { transferKind: "reading_to_meaning" as const }, { finished: false }, { createdAt: now + 1000 }, { text: " " }]) {
      expect(deriveDailyLoop({ ...input, due: 0, production: [{ ...attempt, ...change }] }).useDone).toBe(false);
    }
  });
  it("uses the local calendar boundary and does not inflate progress with repeated reviews", () => {
    const midnight = new Date(now); midnight.setHours(0, 0, 0, 0);
    expect(deriveDailyLoop({ ...input, reviews: [review("a"), review("a"), review("b", midnight.getTime() - 1), review("future", now + 1)] }).reviewed).toBe(1);
  });
  it("adapts the batch to the chosen time budget", () => {
    expect([5, 10, 20].map(reviewLimitFor)).toEqual([3, 6, 10]);
    expect(deriveDailyLoop({ ...input, minutes: 5 }).remaining).toBe(3);
  });
});
