"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isStoreAvailable } from "@/lib/store/db";
import { getCards, getListeningAttempts, getProductionAttempts, getProofAttempts, getReviews, getRetryOutcomes } from "@/lib/store/repository";
import { deriveLearningEvidence, type LearningEvidenceInput } from "./learningEvidence";

const EMPTY: LearningEvidenceInput = { cards: [], reviews: [], production: [], retries: [], listening: [], proofs: [] };

export function useLearningEvidence() {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const request = useRef(0);
  const [now, setNow] = useState(0);
  const refresh = useCallback(async () => {
    const id = ++request.current;
    try {
      if (!isStoreAvailable()) throw new Error("Storage unavailable");
      const [cards, reviews, production, retries, listening, proofs] = await Promise.all([
        getCards(), getReviews(), getProductionAttempts(), getRetryOutcomes(), getListeningAttempts(), getProofAttempts(),
      ]);
      if (id !== request.current) return;
      setData({ cards, reviews, production, retries, listening, proofs });
      setNow(Date.now());
      setError(false);
    } catch {
      if (id === request.current) setError(true);
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const requestRef = request;
    const update = () => { void refresh(); };
    const onVisible = () => { if (!document.hidden) update(); };
    update();
    const events = ["phraseloop:activity", "phraseloop:performance-evidence", "phraseloop:lesson-saved", "phraseloop:backup-restored", "phraseloop:profile-updated", "focus"];
    events.forEach((event) => window.addEventListener(event, update));
    document.addEventListener("visibilitychange", onVisible);
    // Refresh due dates and the local-day boundary even when the app stays open overnight.
    const timer = window.setInterval(onVisible, 60_000);
    return () => {
      requestRef.current++;
      events.forEach((event) => window.removeEventListener(event, update));
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const evidence = useMemo(() => deriveLearningEvidence(data, now), [data, now]);
  return { data, evidence, loading, error, refresh, now };
}
