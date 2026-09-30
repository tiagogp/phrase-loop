/** Invalidates late media work when navigation or another turn supersedes it. */
export function createMediaRun() {
  let active = true;
  let generation = 0;
  let controller: AbortController | null = null;
  return {
    setActive(value: boolean) {
      active = value;
      if (!value) this.cancel();
    },
    cancel() {
      generation += 1;
      controller?.abort();
      controller = null;
    },
    start() {
      this.cancel();
      controller = new AbortController();
      const current = generation;
      const signal = controller.signal;
      return { signal, current: () => active && generation === current && !signal.aborted };
    },
    checkpoint() {
      const current = generation;
      return () => active && generation === current;
    },
  };
}

/** Browser permission dialogs can resolve after the learner leaves the workspace. */
export async function requestActiveMicrophone(
  current: () => boolean,
  acquire: () => Promise<MediaStream> = () => navigator.mediaDevices.getUserMedia({ audio: true }),
): Promise<MediaStream | null> {
  if (!current()) return null;
  const stream = await acquire();
  if (current()) return stream;
  stream.getTracks().forEach((track) => track.stop());
  return null;
}
