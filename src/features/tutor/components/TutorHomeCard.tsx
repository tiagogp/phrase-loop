"use client";

import { useExperience } from "@/features/activation/useExperience";
import { useTutorTranslation } from "../useTutorTranslation";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getLearningProfile } from "@/features/settings/learningProfile";
import { useAiSettings } from "@/features/settings/context/AiSettingsContext";
import { nextTutorReview, tutorRecommendation } from "../model";
import { useTutorMemory } from "../useTutorMemory";

export function TutorHomeCard({ onOpen, onSettings, onLesson, onStudy, onProgress }: { onOpen: () => void; onSettings: () => void; onLesson: () => void; onStudy: () => void; onProgress: () => void }) {
  const { t, lang, localize } = useTutorTranslation();
  const { memory, error, refresh } = useTutorMemory();
  const experience = useExperience();
  const { settings, loading } = useAiSettings();
  const recommendation = memory ? tutorRecommendation(memory.sessions, memory.preferences, getLearningProfile(), memory.loadedAt, lang) : null;
  const providerReady = settings.providers.some(provider => provider.available);
  const minutes = getLearningProfile().dailyMinutes ?? 10;
  const resume = !!recommendation?.active;
  const returnDue = !!recommendation?.due;
  // A saved session remains accessible even while its provider is offline.
  const needsSetup = !loading && !providerReady && !resume;
  const latest = memory?.sessions.filter(session => session.phase === "complete" && session.attempts.length > 0).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))[0];
  const nextReviewAt = latest && memory && !memory.preferences.ignoredEvidenceIds.includes(`session:${latest.id}`) ? nextTutorReview(latest, latest.completedAt ?? latest.updatedAt, memory.sessions, memory.preferences) : undefined;
  const finishedToday = experience.firstLoopComplete && !resume && !returnDue && latest?.completedAt && new Date(latest.completedAt).toDateString() === new Date().toDateString();
  return <Card className="surface-grid-glow border-accent/30 bg-accent/5 p-6 sm:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1 basis-72">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">{finishedToday ? t("Practice saved") : resume ? t("Pick up where you left off") : returnDue ? t("Time to revisit") : t("Your practice today · about {minutes} min", { minutes })}</p>
        <h2 className="mt-2 text-xl font-semibold text-ink sm:text-2xl">{finishedToday ? t("You can pause here") : needsSetup ? t(experience.cards ? "Remember a phrase you saved" : "Start with a guided lesson") : localize(recommendation?.focus ?? t("A real situation, with feedback for you"))}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">{error ? localize(error) : (finishedToday ? t("Your answer and feedback are saved. Return to Today for your next practice.") : needsSetup ? t("Practice with the material already here. Connect an AI when you want feedback on an answer of your own.") : localize(recommendation?.reason ?? t("Loading your history…")))}</p>
      </div>
      <div className="flex flex-wrap gap-2 sm:self-center">
        <Button variant="primary" size="lg" disabled={loading || (!recommendation && !needsSetup)} onClick={finishedToday ? onProgress : needsSetup ? experience.cards ? onStudy : onLesson : onOpen}>{finishedToday ? t("See my progress") : needsSetup ? t(experience.cards ? "Review my phrases" : "Start first lesson") : resume ? t("Continue practice") : t("Start practice")}<span aria-hidden>→</span></Button>
        {needsSetup && <Button variant="ghost" onClick={onSettings}>{t("Connect AI")}</Button>}
        {error && <Button variant="ghost" onClick={() => void refresh()}>{t("Try loading again")}</Button>}
      </div>
    </div>
    {finishedToday && nextReviewAt && <p className="mt-4 text-sm text-ink-soft">{t("Revisit from")} <strong>{new Date(nextReviewAt).toLocaleDateString(lang === "pt" ? "pt-BR" : "en-US")}</strong>. {t("Your next situation will appear in Today.")}</p>}
  </Card>;
}
