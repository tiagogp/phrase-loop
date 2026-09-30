"use client";

import { useMemo, useSyncExternalStore } from "react";
import { isStoreAvailable } from "@/lib/store/db";
import { createSharedResource } from "@/lib/store/sharedResource";
import { getCards, getListeningAttempts, getProductionAttempts, getProofAttempts, getReviews, getRetryOutcomes } from "@/lib/store/repository";
import { deriveLearningEvidence, type LearningEvidenceInput } from "./learningEvidence";

const EMPTY: LearningEvidenceInput = { cards: [], reviews: [], production: [], retries: [], listening: [], proofs: [] };
const resource = createSharedResource(EMPTY, async () => {
  if (!isStoreAvailable()) throw new Error("Storage unavailable");
  const [cards, reviews, production, retries, listening, proofs] = await Promise.all([
    getCards(), getReviews(), getProductionAttempts(), getRetryOutcomes(), getListeningAttempts(), getProofAttempts(),
  ]);
  return { cards, reviews, production, retries, listening, proofs };
}, ["phraseloop:activity", "phraseloop:performance-evidence", "phraseloop:lesson-saved", "phraseloop:backup-restored", "phraseloop:profile-updated"]);

export function useLearningEvidence() {
  const { data, now, loading, error } = useSyncExternalStore(resource.subscribe, resource.getSnapshot, resource.getServerSnapshot);
  const evidence = useMemo(() => deriveLearningEvidence(data, now), [data, now]);
  return { data, evidence, loading, error: !!error, refresh: resource.refresh, now };
}
