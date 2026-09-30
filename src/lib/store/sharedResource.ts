export interface ResourceSnapshot<T> {
  data: T;
  loading: boolean;
  error: string | null;
  now: number;
}

/** Share reads across mounted screens; coalesce save events and reread if a write
 * arrives during a read. The minute clock updates dates without reloading history. */
export function createSharedResource<T>(initial: T, load: () => Promise<T>, events: string[]) {
  const serverSnapshot: ResourceSnapshot<T> = { data: initial, loading: true, error: null, now: 0 };
  let snapshot = serverSnapshot;
  const listeners = new Set<() => void>();
  let dirty = false;
  let pending: Promise<void> | null = null;
  let detach: (() => void) | undefined;
  const publish = (next: ResourceSnapshot<T>) => {
    snapshot = next;
    listeners.forEach(listener => listener());
  };
  const refresh = (): Promise<void> => {
    dirty = true;
    if (pending) return pending;
    pending = Promise.resolve().then(async () => {
      while (dirty && listeners.size && !document.hidden) {
        dirty = false;
        try {
          const data = await load();
          if (!dirty) publish({ data, loading: false, error: null, now: Date.now() });
        } catch (error) {
          if (!dirty) publish({ ...snapshot, loading: false, error: error instanceof Error ? error.message : "Não foi possível carregar seu histórico." });
        }
      }
    }).finally(() => {
      pending = null;
      // A subscriber can enqueue another save between publication and this
      // microtask. Drain that invalidation too, instead of losing it.
      if (dirty && listeners.size && !document.hidden) return refresh();
    });
    return pending;
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    if (listeners.size === 1) {
      const reload = () => { void refresh(); };
      const visible = () => { if (!document.hidden) reload(); };
      events.forEach(event => window.addEventListener(event, reload));
      window.addEventListener("focus", visible);
      document.addEventListener("visibilitychange", visible);
      const timer = window.setInterval(() => {
        if (!document.hidden) publish({ ...snapshot, now: Date.now() });
      }, 60_000);
      detach = () => {
        events.forEach(event => window.removeEventListener(event, reload));
        window.removeEventListener("focus", visible);
        document.removeEventListener("visibilitychange", visible);
        window.clearInterval(timer);
      };
      reload();
    }
    return () => {
      listeners.delete(listener);
      if (!listeners.size) { detach?.(); detach = undefined; }
    };
  };
  return { subscribe, refresh, getSnapshot: () => snapshot, getServerSnapshot: () => serverSnapshot };
}
