import { describe, expect, it, vi } from "vitest";
import { createRefreshQueue } from "./refreshQueue";

describe("refresh queue", () => {
  it("coalesces a burst, then rereads when another write lands during the first pass", async () => {
    let finish!: (value: number) => void;
    const work = vi.fn().mockImplementationOnce(() => new Promise<number>(resolve => { finish = resolve; })).mockResolvedValue(2);
    const refresh = createRefreshQueue(work);
    const first = refresh();
    const burst = refresh();
    await Promise.resolve();
    expect(work).toHaveBeenCalledTimes(1);
    const duringRead = refresh();
    finish(1);
    expect(await Promise.all([first, burst, duringRead])).toEqual([2, 2, 2]);
    expect(work).toHaveBeenCalledTimes(2);
  });

  it("recovers after a failed pass instead of keeping a rejected pending promise", async () => {
    const work = vi.fn().mockRejectedValueOnce(new Error("storage")).mockResolvedValue(2);
    const refresh = createRefreshQueue(work);
    await expect(refresh()).rejects.toThrow("storage");
    await expect(refresh()).resolves.toBe(2);
  });

  it("still processes a queued write when the preceding read fails", async () => {
    let fail!: (error: Error) => void;
    const work = vi.fn().mockImplementationOnce(() => new Promise<number>((_, reject) => { fail = reject; })).mockResolvedValue(2);
    const refresh = createRefreshQueue(work);
    const first = refresh();
    await Promise.resolve();
    const second = refresh();
    fail(new Error("transient failure"));
    expect(await Promise.all([first, second])).toEqual([2, 2]);
  });
});
