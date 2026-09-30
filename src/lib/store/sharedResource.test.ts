import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSharedResource } from "./sharedResource";

let page: EventTarget & { hidden: boolean };
beforeEach(() => {
  vi.useFakeTimers();
  page = Object.assign(new EventTarget(), { hidden: false });
  vi.stubGlobal("document", page);
  vi.stubGlobal("window", Object.assign(new EventTarget(), { setInterval, clearInterval }));
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("shared learning history", () => {
  it("reads once for three screens and coalesces paired save notifications", async () => {
    const load = vi.fn().mockResolvedValue(["saved"]);
    const store = createSharedResource<string[]>([], load, ["tutor", "evidence"]);
    const stops = [store.subscribe(vi.fn()), store.subscribe(vi.fn()), store.subscribe(vi.fn())];
    await store.refresh();
    expect(load).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event("tutor"));
    window.dispatchEvent(new Event("evidence"));
    await store.refresh();
    expect(load).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot().data).toEqual(["saved"]);
    stops.forEach(stop => stop());
    window.dispatchEvent(new Event("evidence"));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not publish a stale read when a save arrives in flight", async () => {
    let finish!: (value: number) => void;
    const load = vi.fn().mockImplementationOnce(() => new Promise<number>(resolve => { finish = resolve; })).mockResolvedValue(2);
    const store = createSharedResource(0, load, ["saved"]);
    const seen: number[] = [];
    const stop = store.subscribe(() => seen.push(store.getSnapshot().data));
    await Promise.resolve();
    window.dispatchEvent(new Event("saved"));
    finish(1);
    await store.refresh();
    expect(load).toHaveBeenCalledTimes(2);
    expect(seen).toEqual([2]);
    stop();
  });

  it("keeps an invalidation queued by a subscriber after publication", async () => {
    const load = vi.fn().mockResolvedValueOnce(1).mockResolvedValue(2);
    const store = createSharedResource(0, load, ["saved"]);
    const stop = store.subscribe(() => {
      if (store.getSnapshot().data === 1) {
        void Promise.resolve().then(() => window.dispatchEvent(new Event("saved")));
      }
    });
    await store.refresh();
    expect(load).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot().data).toBe(2);
    stop();
  });

  it("updates the minute clock without reading history and defers hidden work", async () => {
    const load = vi.fn().mockResolvedValue(1);
    const store = createSharedResource(0, load, ["saved"]);
    const stop = store.subscribe(vi.fn());
    await store.refresh();
    const first = store.getSnapshot();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(store.getSnapshot().now - first.now).toBe(60_000);
    expect(load).toHaveBeenCalledTimes(1);
    page.hidden = true;
    window.dispatchEvent(new Event("saved"));
    await store.refresh();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(load).toHaveBeenCalledTimes(1);
    page.hidden = false;
    page.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
    await store.refresh();
    expect(load).toHaveBeenCalledTimes(2);
    stop();
  });

  it("retains the last good data on error, recovers, and reloads after remount", async () => {
    const load = vi.fn().mockResolvedValueOnce(1).mockRejectedValueOnce(new Error("offline")).mockResolvedValue(3);
    const store = createSharedResource(0, load, []);
    const server = store.getServerSnapshot();
    const stop = store.subscribe(vi.fn());
    await store.refresh();
    await store.refresh();
    expect(store.getSnapshot()).toMatchObject({ data: 1, loading: false, error: "offline" });
    stop();
    const stopAgain = store.subscribe(vi.fn());
    await store.refresh();
    expect(store.getSnapshot()).toMatchObject({ data: 3, error: null });
    expect(store.getServerSnapshot()).toBe(server);
    expect(server.data).toBe(0);
    stopAgain();
  });
});
