import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAll } from "@/lib/store/db";
import * as repository from "@/lib/store/repository";
import * as model from "./model";
import * as evidence from "@/features/progress/learningEvidence";
import { learningHistoryResource as history, learningEvidenceFor } from "@/features/progress/learningHistoryResource";
import { tutorMemoryResource as tutor } from "./tutorMemoryResource";
import { saveTutorPreferences } from "./store";
import { DEFAULT_TUTOR_PREFERENCES } from "./model";

let stops: (() => void)[] = [];
beforeEach(async () => {
  await clearAll();
  vi.stubGlobal("document", Object.assign(new EventTarget(), { hidden: false }));
  vi.stubGlobal("window", Object.assign(new EventTarget(), { setInterval, clearInterval }));
});
afterEach(() => {
  stops.forEach(stop => stop());
  stops = [];
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("shared tutor and progress history", () => {
  it("reads each history once for multiple consumers and derives each result once", async () => {
    const reads = [vi.spyOn(repository, "getCards"), vi.spyOn(repository, "getReviews"), vi.spyOn(repository, "getProductionAttempts")];
    const observations = vi.spyOn(model, "tutorObservations");
    const deriveEvidence = vi.spyOn(evidence, "deriveLearningEvidence");
    stops = [history.subscribe(vi.fn()), tutor.subscribe(vi.fn()), tutor.subscribe(vi.fn())];
    await tutor.refresh();
    reads.forEach(read => expect(read).toHaveBeenCalledTimes(1));
    const memory = tutor.getSnapshot();
    expect(memory.data).not.toBeNull();
    expect(tutor.getSnapshot()).toBe(memory);
    expect(observations).toHaveBeenCalledTimes(1);
    const snapshot = history.getSnapshot();
    expect(learningEvidenceFor(snapshot)).toBe(learningEvidenceFor(snapshot));
    expect(deriveEvidence).toHaveBeenCalledTimes(1);
  });

  it("updates tutor preferences without rereading the learning history", async () => {
    stops = [tutor.subscribe(vi.fn())];
    await tutor.refresh();
    const read = vi.spyOn(repository, "getCards");
    let resolve!: () => void;
    const updated = new Promise<void>(done => { resolve = done; });
    stops.push(tutor.subscribe(() => {
      if (tutor.getSnapshot().data?.preferences.goal === "Travel") resolve();
    }));
    await saveTutorPreferences({ ...DEFAULT_TUTOR_PREFERENCES, goal: "Travel" });
    await updated;
    expect(read).not.toHaveBeenCalled();
  });

  it("refreshes evidence after a write and retains usable history on failure", async () => {
    stops = [tutor.subscribe(vi.fn())];
    await tutor.refresh();
    const prior = tutor.getSnapshot().data;
    const read = vi.spyOn(repository, "getReviews").mockRejectedValueOnce(new Error("read failed"));
    await history.refresh();
    expect(tutor.getSnapshot()).toMatchObject({ data: prior, error: "read failed" });
    read.mockRestore();
    await history.refresh();
    expect(tutor.getSnapshot().error).toBeNull();
    expect(tutor.getSnapshot().data?.cards).toEqual([]);
  });
});
