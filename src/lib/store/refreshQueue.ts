/** Coalesce notifications without dropping writes received during a read/save.
 * Every caller waits for the final pass; passes never overlap. */
export function createRefreshQueue<T>(work: () => Promise<T>) {
  let pending: Promise<T> | null = null;
  let dirty = false;
  const refresh = (): Promise<T> => {
    dirty = true;
    if (pending) return pending;
    pending = Promise.resolve().then(async () => {
      let result: T;
      do {
        dirty = false;
        result = await work();
      } while (dirty);
      return result;
    }).then(result => {
      pending = null;
      return dirty ? refresh() : result;
    }, error => {
      pending = null;
      if (dirty) return refresh();
      throw error;
    });
    return pending;
  };
  return refresh;
}
