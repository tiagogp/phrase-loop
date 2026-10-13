import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { preloadWorkspaces } from "./preloadWorkspaces";

let page: EventTarget & { hidden: boolean };
let idle: Map<number, () => void>;
let stop: (() => void) | undefined;
beforeEach(() => {
  page = Object.assign(new EventTarget(), { hidden: false });
  idle = new Map();
  let nextId = 0;
  vi.stubGlobal("document", page);
  vi.stubGlobal("window", {
    requestIdleCallback: (callback: () => void) => { idle.set(++nextId, callback); return nextId; },
    cancelIdleCallback: (id: number) => idle.delete(id),
  });
});
afterEach(() => { stop?.(); stop = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); });

async function idleTurn() {
  const [id, run] = idle.entries().next().value!;
  idle.delete(id);
  run();
  await new Promise(resolve => setImmediate(resolve));
}

describe("workspace code warmup", () => {
  it("waits for idle and finishes each import before scheduling the next", async () => {
    let finish!: () => void;
    const first = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const second = vi.fn().mockResolvedValue(undefined);
    stop = preloadWorkspaces([first, second]);
    expect(first).not.toHaveBeenCalled();
    await idleTurn();
    expect(first).toHaveBeenCalledOnce();
    expect(idle.size).toBe(0);
    expect(second).not.toHaveBeenCalled();
    finish();
    await new Promise(resolve => setImmediate(resolve));
    await idleTurn();
    expect(second).toHaveBeenCalledOnce();
    expect(idle.size).toBe(0);
  });

  it("pauses while hidden and resumes when the window becomes visible", async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    stop = preloadWorkspaces([load]);
    page.hidden = true;
    await idleTurn();
    expect(load).not.toHaveBeenCalled();
    expect(idle.size).toBe(0);
    page.hidden = false;
    page.dispatchEvent(new Event("visibilitychange"));
    await idleTurn();
    expect(load).toHaveBeenCalledOnce();
  });

  it("continues after a failed import without an unhandled rejection", async () => {
    const next = vi.fn().mockResolvedValue(undefined);
    stop = preloadWorkspaces([() => Promise.reject(new Error("offline")), next]);
    await idleTurn();
    await idleTurn();
    expect(next).toHaveBeenCalledOnce();
  });

  it("cancels queued work and does not resume after cleanup", () => {
    const load = vi.fn().mockResolvedValue(undefined);
    stop = preloadWorkspaces([load]);
    stop();
    page.dispatchEvent(new Event("visibilitychange"));
    expect(idle.size).toBe(0);
    expect(load).not.toHaveBeenCalled();
  });

  it("does not schedule another import when unmounted during a load", async () => {
    let finish!: () => void;
    const next = vi.fn().mockResolvedValue(undefined);
    stop = preloadWorkspaces([() => new Promise<void>(resolve => { finish = resolve; }), next]);
    await idleTurn();
    stop();
    finish();
    await new Promise(resolve => setImmediate(resolve));
    expect(idle.size).toBe(0);
    expect(next).not.toHaveBeenCalled();
  });

  it("supports browsers without requestIdleCallback and cancels the fallback", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", { setTimeout, clearTimeout });
    const first = vi.fn().mockResolvedValue(undefined);
    const next = vi.fn().mockResolvedValue(undefined);
    stop = preloadWorkspaces([first, next]);
    await vi.advanceTimersByTimeAsync(250);
    expect(first).toHaveBeenCalledOnce();
    stop();
    await vi.advanceTimersByTimeAsync(1000);
    expect(next).not.toHaveBeenCalled();
  });
});
