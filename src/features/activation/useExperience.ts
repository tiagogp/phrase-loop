"use client";

import { useMemo } from "react";
import { useTutorMemory } from "@/features/tutor/useTutorMemory";
import { useLearningHistory } from "@/features/progress/useLearningEvidence";
import { DEFAULT_TUTOR_PREFERENCES } from "@/features/tutor/model";
import { deriveExperience } from "./experience";

export function useExperience() {
  const tutor = useTutorMemory();
  const learning = useLearningHistory();
  const experience = useMemo(() => deriveExperience({
    sessions: tutor.memory?.sessions ?? [],
    preferences: tutor.memory?.preferences ?? DEFAULT_TUTOR_PREFERENCES,
    cards: learning.data.cards,
    reviews: learning.data.reviews,
  }), [tutor.memory, learning.data]);
  return { ...experience, ready: !!tutor.memory && !learning.loading && !tutor.error && !learning.error };
}
