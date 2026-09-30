"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { getCounts } from "@/lib/store/repository";
import { getLearningProfile, subscribeToProfile } from "@/features/settings/learningProfile";
import type { TaskItem } from "@/features/plan/schema";
import { useTodayPlan } from "@/features/plan/hooks/useTodayPlan";
import { useLearningEvidence } from "@/features/progress/useLearningEvidence";
import { useExperience } from "@/features/activation/useExperience";
import { dismissDiscovery, useExperiencePreferences } from "@/features/activation/experiencePreferences";
import { useAiSettings } from "@/features/settings/context/AiSettingsContext";
import { useTutorMemory } from "@/features/tutor/useTutorMemory";
import { useTutorTranslation } from "@/features/tutor/useTutorTranslation";
import { nextTutorReview, tutorRecommendation } from "@/features/tutor/model";
import { allowedTutorAttempt } from "@/features/tutor/learning";
import { deriveDailyLoop } from "../dailyLoop";
import { nextPractice } from "../nextPractice";

interface HojeHomeProps {
  onTutor: () => void;
  onStudy: () => void;
  onDiscover: () => void;
  onFirstLesson: () => void;
  onSpeak: () => void;
  onTransfer: () => void;
  onProgress: () => void;
  onExplore: () => void;
  onPlan: () => void;
  onOpenPlanTask: (task: TaskItem) => void;
}

export function HojeHome(props: HojeHomeProps) {
  const { t, lang, localize } = useTutorTranslation();
  const experience = useExperience();
  const { settings, loading: settingsLoading } = useAiSettings();
  const { dismissed } = useExperiencePreferences();
  const { memory, error: tutorError, refresh: refreshTutor } = useTutorMemory();
  const learning = useLearningEvidence();
  const plan = useTodayPlan();
  const [due, setDue] = useState<number | null>(null);
  const [dueError, setDueError] = useState(false);
  const [reload, setReload] = useState(0);
  const minutes = useSyncExternalStore(subscribeToProfile, () => getLearningProfile().dailyMinutes ?? 10, () => 10);
  useEffect(() => {
    let cancelled = false;
    void getCounts().then(counts => { if (!cancelled) { setDue(counts.due); setDueError(false); } })
      .catch(() => { if (!cancelled) setDueError(true); });
    return () => { cancelled = true; };
  }, [learning.now, reload]);

  const now = learning.now;
  const today = (at: number) => at <= now && new Date(at).toDateString() === new Date(now).toDateString();
  const loop = deriveDailyLoop({ ...learning.data, due: due ?? 0, minutes, now });
  const recommendation = memory ? tutorRecommendation(memory.sessions, memory.preferences, getLearningProfile(), now, lang) : null;
  const finished = memory?.sessions.filter(session => session.phase === "complete" && session.completedAt && today(session.completedAt)
    && session.attempts.some(attempt => allowedTutorAttempt(attempt, memory.preferences) && attempt.feedback.status !== "uncertain"))
    .sort((a, b) => b.completedAt! - a.completedAt!)[0];
  // A first local recall is a bounded introduction, not a claim of independent mastery.
  const firstLocalLoop = learning.data.cards.length <= 2 && learning.data.reviews.length > 0
    && learning.data.reviews.every(review => today(review.reviewedAt));
  const planTask = plan.error ? undefined : plan.today?.tasks.find(task => !task.completedAt);
  const completedAt = Math.max(finished?.completedAt ?? 0,
    ...(loop.complete || firstLocalLoop ? learning.data.reviews.map(review => review.reviewedAt) : [0]),
    ...(!plan.error ? plan.today?.tasks.map(task => task.completedAt ?? 0) ?? [0] : [0]));
  const completedToday = !!finished || loop.complete || firstLocalLoop || (completedAt > 0 && today(completedAt));
  const active = recommendation?.active;
  // Completing the local fallback is a place to stop; it does not delete an older tutor draft.
  const resumeNow = !!active && (!completedToday || active.updatedAt > completedAt);
  const action = nextPractice({ active: resumeNow, completedToday,
    tutorDue: !!recommendation?.due, hasAi: settings.providers.some(provider => provider.available), cards: learning.data.cards.length,
    reviewRemaining: loop.remaining, reviewedToday: loop.reviewed, planTask });
  const complete = action === "complete";
  const tutorAction = action === "resume" || action === "revisit" || action === "tutor";
  const reviewAt = finished && memory ? nextTutorReview(finished, finished.completedAt!, memory.sessions, memory.preferences) : undefined;
  const title = tutorAction ? localize(recommendation?.focus ?? "Your next practice") : t(action === "review" ? "Remember a few useful phrases"
    : action === "use" ? "Now use one idea in a new situation" : action === "plan" ? "Your next step in the plan"
      : complete ? "Your practice is saved. You can stop here." : "One useful phrase. One small practice.");
  const detail = tutorAction ? localize(recommendation?.reason ?? "") : action === "plan" ? planTask?.instruction
    : t(action === "review" ? "Start with up to {count} phrases. Then try one answer of your own."
      : action === "use" ? "You already reviewed. Try using a saved idea, with help if you need it."
        : complete ? "You made time for English. A later practice will show what stayed."
          : "See the meaning, try remembering it, and keep it for a later review. No setup needed.", { count: loop.remaining });
  const label = t(action === "resume" ? "Continue practice" : complete ? "See my progress" : action === "review" ? "Start my review"
    : action === "use" ? "Use what I learned" : action === "lesson" ? "Start a short practice" : "Start practice");
  const start = () => {
    if (tutorAction) props.onTutor();
    else if (action === "review") props.onStudy();
    else if (action === "use") props.onTransfer();
    else if (action === "plan" && planTask) props.onOpenPlanTask(planTask);
    else if (complete) props.onProgress();
    else props.onFirstLesson();
  };
  const error = learning.error || tutorError || dueError;
  const ready = !learning.loading && !settingsLoading && !!memory && due !== null && !plan.loading;
  const discovery = complete && experience.ready && experience.discovery && !dismissed.includes(experience.discovery) ? experience.discovery : null;
  return <div className="mx-auto max-w-3xl space-y-6">
    <PageHeader title={t("Today")} description={t("A small practice, a useful result, and a clear place to stop.")} />
    {error ? <Notice tone="error">{t("Could not load your practice history.")} <Button variant="secondary" onClick={() => {
      setReload(value => value + 1); void learning.refresh(); void refreshTutor();
    }}>{t("Try again")}</Button></Notice> : !ready ? <Card className="p-6"><p role="status">{t("Preparing your next practice…")}</p></Card> :
      <Card className="space-y-5 border-accent/25 bg-accent/5 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">{t(complete ? "Practice saved" : action === "resume" ? "Pick up where you left off" : "Your next practice")}</p>
        <h2 className="max-w-xl text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{title}</h2>
        <p className="max-w-xl text-sm leading-relaxed text-ink-soft">{detail}</p>
        {!complete && <p className="text-xs text-ink-muted">{t("About {count} min · you can pause anytime", { count: action === "lesson" ? 3 : minutes })}</p>}
        {reviewAt && complete && <p className="text-sm text-ink-soft">{t("Revisit from")} <strong>{new Date(reviewAt).toLocaleDateString(lang === "pt" ? "pt-BR" : "en-US")}</strong>. {t("Your next situation will appear in Today.")}</p>}
        {complete && !reviewAt && <p className="text-sm text-ink-soft">{t("Come back to Today for your next short practice. Your phrases keep their review schedule.")}</p>}
        <div className="flex flex-wrap items-center gap-3"><Button variant={complete ? "secondary" : "primary"} size="lg" onClick={start}>{label}<span aria-hidden="true">→</span></Button>
          {!complete && <Button variant="ghost" onClick={props.onExplore}>{t("Choose another activity")}</Button>}</div>
        {!complete && !experience.firstLoopComplete && <p className="border-t border-line pt-4 text-xs leading-relaxed text-ink-muted">{t(action === "lesson" ? "See one phrase → try remembering → save your practice" : "Try → understand the feedback → try again when needed")}</p>}
      </Card>}
    {discovery && <aside className="rounded-lg border border-line p-4">
      <p className="text-sm text-ink-soft">{t(discovery === "review" ? "You saved a phrase. Try remembering it before looking." : discovery === "content" ? "Want to use something from your own day next time?" : "Take an idea you practiced into a conversation.")}</p>
      <div className="mt-3 flex gap-2"><Button variant="ghost" size="sm" onClick={() => {
        dismissDiscovery(discovery); (discovery === "review" ? props.onStudy : discovery === "content" ? props.onDiscover : props.onSpeak)();
      }}>{t(discovery === "review" ? "Review my phrases" : discovery === "content" ? "Add content" : "Have a free conversation")}</Button><Button variant="ghost" size="sm" onClick={() => dismissDiscovery(discovery)}>{t("Not now")}</Button></div>
    </aside>}
    <nav aria-label={t("Learning overview")} className="flex flex-wrap gap-2 border-t border-line pt-3">
      <Button variant="ghost" size="sm" onClick={props.onProgress}>{t("My progress")}</Button>
      <Button variant="ghost" size="sm" onClick={props.onPlan}>{t("My goal and plan")}</Button>
      {complete && <Button variant="ghost" size="sm" onClick={props.onExplore}>{t("Explore")}</Button>}
    </nav>
  </div>;
}
