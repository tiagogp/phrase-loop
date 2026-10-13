/** Warm code only, one chunk per idle turn. Screens, media and AI work stay
 * unmounted until requested. A failed warmup must not block later navigation. */
export function preloadWorkspaces(loaders: readonly (() => Promise<unknown>)[]) {
  let stopped = false;
  let index = 0;
  let pending = false;
  let cancelIdle: (() => void) | undefined;

  function schedule() {
    if (stopped || document.hidden || pending || cancelIdle || index >= loaders.length) return;
    const run = () => {
      cancelIdle = undefined;
      if (stopped || document.hidden) return;
      pending = true;
      void Promise.resolve().then(loaders[index++]).catch(() => {
        // The normal screen loader owns the visible error/retry experience.
      }).finally(() => {
        pending = false;
        schedule();
      });
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(run);
      cancelIdle = () => window.cancelIdleCallback(id);
    } else {
      const id = window.setTimeout(run, 250);
      cancelIdle = () => window.clearTimeout(id);
    }
  }

  document.addEventListener("visibilitychange", schedule);
  schedule();
  return () => {
    stopped = true;
    cancelIdle?.();
    document.removeEventListener("visibilitychange", schedule);
  };
}
