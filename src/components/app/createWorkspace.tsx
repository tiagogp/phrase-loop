"use client";

import { lazy, Suspense, useState, type ComponentType } from "react";

/** A warmed screen can render synchronously on its first visit. Importing code
 * alone leaves React.lazy unresolved and can still briefly show its fallback. */
export function createWorkspace<Props extends object>(
  load: () => Promise<{ default: ComponentType<Props> }>,
  Loading: ComponentType,
) {
  let ready: ComponentType<Props> | undefined;
  const LazyScreen = lazy(load);

  function Screen(props: Props) {
    // Keep the chosen type for this mount so a warmup completing in the
    // background cannot remount an already open screen and erase its draft.
    const [Component] = useState(() => ready ?? LazyScreen);
    return <Suspense fallback={<Loading />}><Component {...props} /></Suspense>;
  }

  async function preload() {
    ready = (await load()).default;
  }

  return { Screen, preload };
}
