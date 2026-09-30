"use client";

import { useEffect, useSyncExternalStore } from "react";
import { HOME_TABS, type HomeTab } from "@/components/app/homeTabs";
import { countDueCards, getCounts } from "@/lib/store/repository";
import { count, isStoreAvailable, STORES } from "@/lib/store/db";
import { createSharedResource } from "@/lib/store/sharedResource";
import { getLearningProfile, saveLearningProfile } from "@/features/settings/learningProfile";
import { OWN_SENTENCE_CARD_PREFIX } from "@/features/learn/lessonDeck";
import type { EnglishLevel } from "@/features/discover/types";

export interface UnlockSignals {
  cards: number;
  reviews: number;
  errorEvents: number;
  /**
   * Own sentences written at the end of the lesson loop. Counts toward tier 3 so
   * a learner whose first sentence had nothing to fix (no ErrorEvent) still
   * unlocks Correct and the AI settings.
   */
  ownSentences?: number;
}

export const MAX_UNLOCK_TIER = 3;

export function computeUnlockedTabTier(signals: UnlockSignals, storedTier = 0): number {
  let tier = 0;
  if (signals.cards > 0) tier = 1;
  if (signals.reviews > 0) tier = 2;
  if (signals.errorEvents > 0 || (signals.ownSentences ?? 0) > 0) tier = 3;
  return Math.max(0, Math.min(MAX_UNLOCK_TIER, Math.max(storedTier, tier)));
}

/**
 * Gates that are not about progress through the method. Unlike the tier, these can go both ways:
 * change the declared level or disconnect the provider and the tab goes away again.
 */
export interface TabGates {
  level?: EnglishLevel;
  /** Whether an LLM provider is actually configured and reachable. */
  hasEvaluator?: boolean;
}

export function tabsForUnlockTier(tier: number, gates?: TabGates): HomeTab[] {
  // Keep compatibility with saved tiers; the primary destinations are always available.
  void tier;
  void gates;
  return HOME_TABS.map((tab) => tab.id);
}

/** Query counts only: unlocking does not need phrase text, sources or corrections. */
export async function loadTabUnlockSnapshot(): Promise<{ tier: number; dueCount: number }> {
  const profile = getLearningProfile();
  if (!isStoreAvailable()) return { tier: profile.unlockedTabTier, dueCount: 0 };
  if (profile.unlockedTabTier === MAX_UNLOCK_TIER) {
    return { tier: MAX_UNLOCK_TIER, dueCount: await countDueCards() };
  }
  const ownSentencesRange = IDBKeyRange.bound(OWN_SENTENCE_CARD_PREFIX, `${OWN_SENTENCE_CARD_PREFIX}\uffff`);
  const [counts, errorEvents, ownSentences] = await Promise.all([
    getCounts(), count(STORES.errorEvents), count(STORES.cards, ownSentencesRange),
  ]);
  return {
    tier: computeUnlockedTabTier({ cards: counts.cards, reviews: counts.reviews, errorEvents, ownSentences }, profile.unlockedTabTier),
    dueCount: counts.due,
  };
}

const unlockResource = createSharedResource({ tier: 0, dueCount: 0 }, loadTabUnlockSnapshot, [
  "phraseloop:activity", "phraseloop:lesson-saved", "phraseloop:backup-restored", "phraseloop:profile-updated",
]);
const clearAnnouncement = () => {};

export function useUnlockedTabs({ hasEvaluator = false }: { hasEvaluator?: boolean } = {}): {
  tabs: ReadonlyArray<(typeof HOME_TABS)[number]>;
  tier: number;
  dueCount: number;
  announcement: HomeTab | null;
  clearAnnouncement: () => void;
} {
  void hasEvaluator;
  const { data, loading } = useSyncExternalStore(unlockResource.subscribe, unlockResource.getSnapshot, unlockResource.getServerSnapshot);
  // Persist only a published snapshot; a write arriving during a read makes the
  // resource reread before publishing, so stale evidence cannot raise the tier.
  useEffect(() => {
    if (!loading && data.tier > getLearningProfile().unlockedTabTier) {
      saveLearningProfile({ unlockedTabTier: data.tier });
    }
  }, [data, loading]);
  return { tabs: HOME_TABS, ...data, announcement: null, clearAnnouncement };
}
