import { describe, expect, it, vi } from "vitest";
import { createMediaRun, requestActiveMicrophone } from "./mediaRun";

describe("conversation media lifetime", () => {
  it("aborts synthesis and rejects late microphone/transcription after leaving and returning", () => {
    const media = createMediaRun();
    const reply = media.start();
    const permission = media.checkpoint();
    media.setActive(false);
    media.setActive(true);
    expect(reply.signal.aborted).toBe(true);
    expect(reply.current()).toBe(false);
    expect(permission()).toBe(false);
    expect(media.checkpoint()()).toBe(true);
  });

  it("only lets the newest turn play, even if old synthesis ignores its abort signal", async () => {
    const media = createMediaRun();
    const played: string[] = [];
    let completeOld!: () => void;
    const delayed = new Promise<void>((resolve) => { completeOld = resolve; });
    const first = media.start();
    const old = delayed.then(() => { if (first.current()) played.push("old"); });
    const second = media.start();
    if (second.current()) played.push("new");
    completeOld();
    await old;
    expect(played).toEqual(["new"]);
    expect(first.signal.aborted).toBe(true);
  });

  it("does not re-arm hands-free recording after a session is finished", () => {
    const media = createMediaRun();
    const reply = media.start();
    media.cancel();
    expect(reply.current()).toBe(false);
  });
});


describe("microphone permission resolving after navigation", () => {
  it("stops every track instead of starting a hidden recording", async () => {
    const media = createMediaRun();
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
    let allow!: (stream: MediaStream) => void;
    const permission = new Promise<MediaStream>((resolve) => { allow = resolve; });
    const pending = requestActiveMicrophone(media.checkpoint(), () => permission);
    media.setActive(false);
    media.setActive(true);
    allow(stream);
    expect(await pending).toBeNull();
    expect(stop).toHaveBeenCalledOnce();
  });

  it("does not request permission for an inactive workspace", async () => {
    const acquire = vi.fn();
    expect(await requestActiveMicrophone(() => false, acquire)).toBeNull();
    expect(acquire).not.toHaveBeenCalled();
  });

  it("returns the permitted live stream while the workspace remains active", async () => {
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
    expect(await requestActiveMicrophone(() => true, async () => stream)).toBe(stream);
    expect(stop).not.toHaveBeenCalled();
  });
});
