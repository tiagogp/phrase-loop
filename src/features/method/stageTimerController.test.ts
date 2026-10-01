import { describe, expect, it } from "vitest";
import { createStageTimerController } from "./stageTimerController";

describe("stage attention", () => {
  it("discards abandoned retry time and only credits the next retry", () => {
    const timer = createStageTimerController(false);
    timer.setAvailable(true, 0);
    timer.start(1000);
    timer.touch(20_000);
    timer.discard();
    timer.setAvailable(false, 30_000);
    timer.setAvailable(true, 40_000);
    expect(timer.commit(50_000)).toBeNull();
    timer.start(60_000);
    expect(timer.commit(70_000)).toBe(10_000);
  });

  it("excludes interactions in a retained, hidden workspace and resumes on return", () => {
    const timer = createStageTimerController(true);
    timer.setAvailable(true, 0);
    timer.setAvailable(false, 10_000);
    timer.touch(60_000);
    timer.touch(120_000);
    timer.setAvailable(true, 180_000);
    expect(timer.commit(200_000)).toBe(30_000);
  });

  it("keeps an explicit audio pause through clicks and window focus changes", () => {
    const timer = createStageTimerController(false);
    timer.setAvailable(true, 0);
    timer.start(10_000);
    timer.pause(20_000);
    timer.touch(30_000);
    timer.setAvailable(false, 40_000);
    timer.setAvailable(true, 50_000);
    timer.touch(60_000);
    expect(timer.commit(100_000)).toBe(10_000);
  });

  it("does not start an event-driven stage merely because the window gains focus", () => {
    const timer = createStageTimerController(false);
    timer.setAvailable(true, 0);
    timer.touch(10_000);
    timer.setAvailable(false, 20_000);
    timer.setAvailable(true, 30_000);
    expect(timer.commit(60_000)).toBeNull();
  });

  it("banks one stage exactly once and requires a new start after commit", () => {
    const timer = createStageTimerController(true);
    timer.setAvailable(true, 0);
    expect(timer.commit(10_000)).toBe(10_000);
    timer.touch(20_000);
    timer.setAvailable(false, 30_000);
    timer.setAvailable(true, 40_000);
    expect(timer.commit(50_000)).toBeNull();
    timer.start(60_000);
    expect(timer.commit(70_000)).toBe(10_000);
  });

  it("can resume a explicitly paused stage only through start", () => {
    const timer = createStageTimerController(true);
    timer.setAvailable(true, 0);
    timer.pause(10_000);
    timer.start(50_000);
    expect(timer.commit(60_000)).toBe(20_000);
  });
});
