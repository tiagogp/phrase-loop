import { describe, expect, it } from "vitest";
import { computeUnlockedTabTier, tabsForUnlockTier } from "./useUnlockedTabs";

describe("stable learning navigation", () => {
  const destinations = ["hoje", "study", "explore", "conversa", "discover", "progress"];
  it("keeps core destinations visible from day one, including progress and conversation", () => {
    expect(tabsForUnlockTier(0)).toEqual(destinations);
  });
  it("does not move destinations as a learner progresses or changes their provider", () => {
    for (const tier of [0, 1, 2, 3]) {
      for (const level of ["A1", "A2", "B1", "B2", "C1", "C2"] as const) {
        for (const hasEvaluator of [false, true]) {
          expect(tabsForUnlockTier(tier, { level, hasEvaluator })).toEqual(destinations);
        }
      }
    }
  });
  it("preserves existing disclosure progress without migrating or resetting profiles", () => {
    expect(computeUnlockedTabTier({ cards: 1, reviews: 0, errorEvents: 0 })).toBe(1);
    expect(computeUnlockedTabTier({ cards: 1, reviews: 1, errorEvents: 0 })).toBe(2);
    expect(computeUnlockedTabTier({ cards: 1, reviews: 1, errorEvents: 1 })).toBe(3);
    expect(computeUnlockedTabTier({ cards: 1, reviews: 0, errorEvents: 0, ownSentences: 1 })).toBe(3);
    expect(computeUnlockedTabTier({ cards: 0, reviews: 0, errorEvents: 0 }, 3)).toBe(3);
  });
});
