import { createSharedResource, type ResourceSnapshot } from "@/lib/store/sharedResource";
import { learningHistoryResource as history } from "@/features/progress/learningHistoryResource";
import { getTutorPreferences, getTutorSessions, type TutorMemory } from "./store";
import { tutorObservations } from "./model";

const metadata = createSharedResource<Pick<TutorMemory, "sessions" | "preferences"> | null>(null, async () => {
  const [sessions, preferences] = await Promise.all([getTutorSessions(), getTutorPreferences()]);
  return { sessions, preferences };
}, ["phraseloop:tutor-updated", "phraseloop:backup-restored", "phraseloop:profile-updated"]);

function createSnapshotReader(readHistory: typeof history.getSnapshot, readMetadata: typeof metadata.getSnapshot) {
  let previousHistory: ReturnType<typeof readHistory> | undefined;
  let previousMetadata: ReturnType<typeof readMetadata> | undefined;
  let snapshot: ResourceSnapshot<TutorMemory | null>;
  return () => {
    const learning = readHistory();
    const tutor = readMetadata();
    if (learning === previousHistory && tutor === previousMetadata) return snapshot;
    const now = Math.max(learning.now, tutor.now);
    let memory = snapshot?.data ?? null;
    if (tutor.data && !learning.loading) {
      if (!memory || learning.data !== previousHistory?.data || tutor.data !== previousMetadata?.data) {
        const { sessions, preferences } = tutor.data;
        const { cards, production, reviews } = learning.data;
        memory = { sessions, preferences, cards, observations: tutorObservations({ sessions, cards, production, reviews }), loadedAt: now };
      } else if (memory.loadedAt !== now) memory = { ...memory, loadedAt: now };
    }
    snapshot = { data: memory, now, loading: learning.loading || tutor.loading, error: tutor.error ?? learning.error };
    previousHistory = learning;
    previousMetadata = tutor;
    return snapshot;
  };
}

/** Tutor-specific metadata stays independent; the large history is read once for
 * both the tutor and progress. Imperative loadTutorMemory still reads fresh data. */
export const tutorMemoryResource = {
  subscribe(listener: () => void) {
    const stopHistory = history.subscribe(listener);
    const stopMetadata = metadata.subscribe(listener);
    return () => { stopHistory(); stopMetadata(); };
  },
  getSnapshot: createSnapshotReader(history.getSnapshot, metadata.getSnapshot),
  getServerSnapshot: createSnapshotReader(history.getServerSnapshot, metadata.getServerSnapshot),
  async refresh() { await Promise.all([history.refresh(), metadata.refresh()]); },
};
