import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAll, put, STORES } from "@/lib/store/db";
import { DEFAULT_LEARNING_PROFILE, getLearningProfile } from "@/features/settings/learningProfile";
import { loadTabUnlockSnapshot } from "./useUnlockedTabs";

vi.mock("@/features/settings/learningProfile", async importOriginal => {
  const original = await importOriginal<typeof import("@/features/settings/learningProfile")>();
  return { ...original, getLearningProfile: vi.fn(() => ({ ...original.DEFAULT_LEARNING_PROFILE, unlockedTabTier: 0 })) };
});

beforeEach(async () => {
  vi.stubGlobal("window", {});
  vi.mocked(getLearningProfile).mockReturnValue({ ...DEFAULT_LEARNING_PROFILE, unlockedTabTier: 0 });
  await clearAll();
});
afterEach(async () => { vi.restoreAllMocks(); await clearAll(); vi.unstubAllGlobals(); });

describe("navigation queries", () => {
  it("detects a learner's own sentence by key range without loading cards or errors", async () => {
    await put(STORES.cards, { id: "own-sentence-lesson-1" });
    await put(STORES.cards, { id: "other-own-sentence-lesson-1" });
    const allRows = vi.spyOn(IDBObjectStore.prototype, "getAll");
    expect(await loadTabUnlockSnapshot()).toEqual({ tier: 3, dueCount: 0 });
    expect(allRows).not.toHaveBeenCalled();
  });

  it("does not treat a phrase containing the prefix as an own sentence", async () => {
    await put(STORES.cards, { id: "other-own-sentence-lesson-1" });
    expect(await loadTabUnlockSnapshot()).toEqual({ tier: 1, dueCount: 0 });
    await put(STORES.reviews, { id: "review-1" });
    expect((await loadTabUnlockSnapshot()).tier).toBe(2);
    await put(STORES.errorEvents, { id: "error-1" });
    expect((await loadTabUnlockSnapshot()).tier).toBe(3);
  });

  it("skips all unlock evidence at the maximum tier and keeps the due badge current", async () => {
    vi.mocked(getLearningProfile).mockReturnValue({ ...DEFAULT_LEARNING_PROFILE, unlockedTabTier: 3 });
    await put(STORES.srs, { cardId: "due", due: Date.now() - 1 });
    await put(STORES.srs, { cardId: "future", due: Date.now() + 60_000 });
    const countStore = vi.spyOn(IDBObjectStore.prototype, "count");
    const allRows = vi.spyOn(IDBObjectStore.prototype, "getAll");
    expect(await loadTabUnlockSnapshot()).toEqual({ tier: 3, dueCount: 1 });
    expect(countStore).not.toHaveBeenCalled();
    expect(allRows).not.toHaveBeenCalled();
  });
});
