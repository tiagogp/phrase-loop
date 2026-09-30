"use client";

import { useSyncExternalStore } from "react";
import { learningHistoryResource as resource, learningEvidenceFor } from "./learningHistoryResource";

export function useLearningHistory() {
  return useSyncExternalStore(resource.subscribe, resource.getSnapshot, resource.getServerSnapshot);
}

export function useLearningEvidence() {
  const snapshot = useLearningHistory();
  const { data, now, loading, error } = snapshot;
  const evidence = learningEvidenceFor(snapshot);
  return { data, evidence, loading, error: !!error, refresh: resource.refresh, now };
}
