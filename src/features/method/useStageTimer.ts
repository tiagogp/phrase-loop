"use client";

import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { MethodStage } from "@/features/method/learningLoop";
import { stageMinutes } from "@/features/method/stageTimer";
import { createStageTimerController } from "./stageTimerController";
import { WorkspaceActivityContext } from "@/lib/workspaceActivity";

export interface StageTimer {
  /** Start or resume measuring. Idempotent. */
  start: () => void;
  /** Mark an interaction so an idle window stops accruing (audio ticks, keystrokes). */
  touch: () => void;
  /** Stop without discarding what is banked — e.g. the learner paused the audio. */
  pause: () => void;
  /**
   * Stop, reset, and return the clamped minutes for exactly one `method_stage` emit.
   * Pass `stage` when the window's stage is only known on submit — lesson production is
   * `speak` when it was spoken and `feedback` when it was typed, but it is one window.
   */
  commit: (stage?: MethodStage) => number;
}

/**
 * Measures how long a method stage actually took, so the balance in `learningLoop` is a
 * ledger rather than an estimate. All arithmetic lives in `stageTimer.ts`, which is pure
 * and tested; this hook only wires it to the DOM signals that reveal attention.
 *
 * @param fallbackMinutes what the stage used to be worth as a hardcoded constant. Emitted
 * when nothing could be measured, so the ledger degrades to the old behaviour, not to zero.
 * @param options.autoStart start on mount. Pass false for event-driven stages like
 * `listen`, whose window opens when the audio plays rather than when the tab renders.
 */
export function useStageTimer(
  stage: MethodStage,
  fallbackMinutes: number,
  options: { autoStart?: boolean; active?: boolean } = {},
): StageTimer {
  const { autoStart = true } = options;
  const workspaceActive = useContext(WorkspaceActivityContext);
  const active = workspaceActive && (options.active ?? true);
  const [controller] = useState(() => createStageTimerController(autoStart));

  const start = useCallback(() => {
    controller.start(Date.now());
  }, [controller]);

  const touch = useCallback(() => {
    controller.touch(Date.now());
  }, [controller]);

  const pause = useCallback(() => {
    controller.pause(Date.now());
  }, [controller]);

  const commit = useCallback(
    (stageOverride?: MethodStage) => {
      const elapsed = controller.commit(Date.now());
      if (elapsed == null) return fallbackMinutes;
      return stageMinutes(stageOverride ?? stage, elapsed, fallbackMinutes);
    },
    [controller, stage, fallbackMinutes],
  );

  useEffect(() => {
    const onVisibility = () => controller.setAvailable(active && !document.hidden && document.hasFocus(), Date.now());
    const onBlur = () => controller.setAvailable(false, Date.now());
    onVisibility();
    if (!active) return;

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onVisibility);
    document.addEventListener("pointerdown", touch, { passive: true });
    document.addEventListener("keydown", touch, { passive: true });

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onVisibility);
      document.removeEventListener("pointerdown", touch);
      document.removeEventListener("keydown", touch);
      controller.setAvailable(false, Date.now());
    };
  }, [active, controller, touch]);

  return useMemo(() => ({ start, touch, pause, commit }), [start, touch, pause, commit]);
}
