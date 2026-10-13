import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAll } from "@/lib/store/db";
import * as activity from "@/lib/store/activityLog";
import * as store from "./store";
import type { LearningPlan } from "./schema";
import { dateString } from "./utils";
import { todayPlanResource as resource } from "./todayPlanResource";

let stops: (() => void)[] = [];
function plan(): LearningPlan {
  const date = dateString(new Date());
  return {
    id: "plan", createdAt: Date.now(), startsOn: date,
    meta: { goal: "Travel", currentLevel: "A2", targetLevel: "B1", availabilityMinutes: 10, planDays: 1, language: "pt" },
    phases: [],
    days: [{ date, phase: 1, estimatedMinutes: 10, tasks: [{ id: "review", type: "study", instruction: "Review", targetMetric: { action: "cards_reviewed", quantity: 2 } }] }],
  };
}
beforeEach(async () => {
  await clearAll();
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
  vi.stubGlobal("document", Object.assign(new EventTarget(), { hidden: false }));
  vi.stubGlobal("window", Object.assign(new EventTarget(), { setInterval, clearInterval }));
  await store.savePlan(plan());
});
afterEach(() => { stops.forEach(stop => stop()); stops = []; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("plan navigation data", () => {
  it("opens the plan from Today's already loaded data with no new loading state or read", async () => {
    const read = vi.spyOn(store, "getActivePlan");
    stops.push(resource.subscribe(vi.fn()));
    await resource.refresh();
    const ready = resource.getSnapshot();
    expect(ready.loading).toBe(false);
    expect(ready.data.plan?.id).toBe("plan");
    const closePlan = resource.subscribe(vi.fn());
    expect(resource.getSnapshot()).toBe(ready);
    closePlan();
    stops.push(resource.subscribe(vi.fn()));
    expect(resource.getSnapshot()).toBe(ready);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("keeps the current plan visible while refreshing and shares the new plan", async () => {
    stops.push(resource.subscribe(vi.fn()));
    await resource.refresh();
    const previous = resource.getSnapshot().data;
    const updated = { ...plan(), id: "new-plan" };
    let finish!: (value: LearningPlan) => void;
    vi.spyOn(store, "getActivePlan").mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const refresh = resource.refresh();
    await Promise.resolve();
    expect(resource.getSnapshot()).toMatchObject({ data: previous, loading: false });
    finish(updated);
    await refresh;
    expect(resource.getSnapshot().data.plan?.id).toBe("new-plan");
    expect(resource.getSnapshot().loading).toBe(false);
  });

  it("applies completion evidence once for multiple mounted screens", async () => {
    vi.spyOn(activity, "getActivitySince").mockResolvedValue([{ id: "reviewed", ts: Date.now(), type: "cards_reviewed", payload: { count: 2, cardIds: ["one", "two"] } }]);
    const complete = vi.spyOn(store, "updateDayTask");
    stops = [resource.subscribe(vi.fn()), resource.subscribe(vi.fn())];
    await resource.refresh();
    expect(complete).toHaveBeenCalledTimes(1);
    expect(resource.getSnapshot().data.today?.tasks[0].evidenceCount).toBe(2);
    await resource.refresh();
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("refreshes after a plan deletion without keeping the old plan cached", async () => {
    stops.push(resource.subscribe(vi.fn()));
    await resource.refresh();
    await store.deletePlan("plan");
    await resource.refresh();
    expect(resource.getSnapshot()).toMatchObject({ data: { plan: null, today: null }, loading: false, error: null });
  });
});
