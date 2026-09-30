import { createTimer, creditedMs, pauseTimer, resumeTimer, touchTimer, type StageTimerState } from "./stageTimer";

/** Explicit pauses and temporary loss of attention are different: only the latter
 * resumes automatically when the learner returns to this workspace. */
export function createStageTimerController(autoStart: boolean) {
  let state: StageTimerState | null = null;
  let requested = autoStart;
  let available = false;
  const sync = (now: number) => {
    if (requested && available) state = state ? resumeTimer(state, now) : createTimer(now);
    else if (state) state = pauseTimer(state, now);
  };
  return {
    setAvailable(next: boolean, now: number) { available = next; sync(now); },
    start(now: number) { requested = true; sync(now); },
    pause(now: number) { requested = false; sync(now); },
    touch(now: number) {
      if (requested && available && state) state = touchTimer(state, now);
    },
    commit(now: number): number | null {
      const elapsed = state ? creditedMs(state, now) : null;
      state = null;
      requested = false;
      return elapsed;
    },
  };
}
