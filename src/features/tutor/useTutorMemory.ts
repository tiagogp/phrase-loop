"use client";

import { useMemo, useSyncExternalStore } from "react";
import { createSharedResource } from "@/lib/store/sharedResource";
import { loadTutorMemory, type TutorMemory } from "./store";

const resource = createSharedResource<TutorMemory | null>(null, loadTutorMemory, [
  "phraseloop:tutor-updated", "phraseloop:performance-evidence", "phraseloop:backup-restored",
  "phraseloop:lesson-saved", "phraseloop:profile-updated", "phraseloop:activity",
]);

export function useTutorMemory() {
  const { data, now, error } = useSyncExternalStore(resource.subscribe, resource.getSnapshot, resource.getServerSnapshot);
  const memory = useMemo(() => data ? { ...data, loadedAt: now } : null, [data, now]);
  return { memory, error, refresh: resource.refresh };
}
