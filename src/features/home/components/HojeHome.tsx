"use client";

import Disclosure from "@/components/ui/Disclosure";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { getCounts } from "@/lib/store/repository";
import { useT } from "@/i18n/I18nProvider";
import { DEFAULT_LEARNING_PROFILE, getLearningProfile, saveLearningProfile, subscribeToProfile } from "@/features/settings/learningProfile";
import { TodayPlanCard } from "@/features/plan/components/TodayPlanCard";
import type { TaskItem } from "@/features/plan/schema";
import { useLearningEvidence } from "@/features/progress/useLearningEvidence";
import { LearningWins } from "@/features/progress/components/LearningWins";
import { deriveDailyLoop } from "../dailyLoop";
import { useExperience } from "@/features/activation/useExperience";
import { dismissDiscovery, useExperiencePreferences } from "@/features/activation/experiencePreferences";
import { TutorHomeCard } from "@/features/tutor/components/TutorHomeCard";
import { useAiSettings } from "@/features/settings/context/AiSettingsContext";

interface HojeHomeProps {
  onTutor: () => void;
  onNewTutor: () => void;
  onTutorSettings: () => void;
  onStudy: () => void;
  onDiscover: () => void;
  onCorrect: () => void;
  onFirstLesson: () => void;
  onLesson: (lessonId?: string) => void;
  onSpeak: () => void;
  onTransfer: () => void;
  onProgress: () => void;
  onTools: () => void;
  onOpenPlanTask: (task: TaskItem) => void;
  onCreatePlan: () => void;
  onInstallDefaultPlan: () => void;
}

export function HojeHome(props: HojeHomeProps) {
  const { t } = useT();
  const experience = useExperience();
  const { settings, loading: settingsLoading } = useAiSettings();
  const hasAi = settings.providers.some(provider => provider.available);
  const { dismissed, fullNavigation } = useExperiencePreferences();
  const discovery = experience.ready && !experience.active && experience.discovery && !dismissed.includes(experience.discovery) ? experience.discovery : null;
  const { data, evidence, loading, error, refresh, now } = useLearningEvidence();
  const [due, setDue] = useState<number | null>(null);
  const [dueError, setDueError] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const [practiceOptionsOpen, setPracticeOptionsOpen] = useState<boolean | null>(null);
  const [showDailyLoop, setShowDailyLoop] = useState(false);
  const minutes = useSyncExternalStore(subscribeToProfile, () => getLearningProfile().dailyMinutes ?? 10, () => DEFAULT_LEARNING_PROFILE.dailyMinutes ?? 10);

  useEffect(() => {
    let cancelled = false;
    void getCounts().then((counts) => {
      if (!cancelled) { setDue(counts.due); setDueError(false); }
    }).catch(() => { if (!cancelled) setDueError(true); });
    return () => { cancelled = true; };
  }, [now]);

  const loop = deriveDailyLoop({ ...data, due: due ?? 0, minutes, now });
  const action = loop.next === "lesson" ? props.onFirstLesson
    : loop.next === "review" ? props.onStudy : loop.next === "use" ? props.onTransfer : props.onProgress;
  const ready = !loading && due !== null && !error && !dueError;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t("Today's English mistakes become tomorrow's practice")} title={t("Today")}
        description={t("Practice a real situation. PhraseLoop remembers the difficulty and checks it again in another context.")} />
      <TutorHomeCard onOpen={props.onTutor} onSettings={props.onTutorSettings} onLesson={props.onFirstLesson} onStudy={props.onStudy} onProgress={props.onProgress} />
      {experience.ready && !settingsLoading && !experience.firstLoopComplete && <ol aria-label={t("Your first practice")} className="grid gap-3 sm:grid-cols-3">
        {hasAi ? <>
        <LoopStep number={1} title={t("Try in your own words")} done={experience.hasResult} detail={t("One short answer is enough to begin.")} />
        <LoopStep number={2} title={t("Understand one adjustment")} done={experience.hasResult} detail={t("Feedback comes from what you tried to say.")} />
        <LoopStep number={3} title={t("Try again, then pause")} done={false} detail={t("Keep the useful part for your next practice.")} />
        </> : <>
          <LoopStep number={1} title={t("Choose a useful phrase")} done={experience.cards > 0} detail={t("Start from a guided lesson or your own material.")} />
          <LoopStep number={2} title={t("Save what you want to remember")} done={experience.cards > 0} detail={t("Your saved phrases stay in Phrases.")} />
          <LoopStep number={3} title={t("Try remembering before you look")} done={false} detail={t("Review a saved phrase, then return when it is due.")} />
        </>}
      </ol>}
      {discovery && <aside className="rounded-lg border border-line bg-card p-4" aria-label={t("A next possibility")}>
        <p className="text-sm text-ink-soft">{t(discovery === "review" ? "You saved a phrase. Try remembering it before looking."
          : discovery === "content" ? "You have practiced a complete cycle. Now try a phrase from your own day."
            : "Take an idea you practiced into a conversation.")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => { dismissDiscovery(discovery); (discovery === "review" ? props.onStudy : discovery === "content" ? props.onDiscover : props.onSpeak)(); }}>{t(discovery === "review" ? "Review my phrases" : discovery === "content" ? "Add content" : "Have a free conversation")}</Button>
          <Button variant="ghost" size="sm" onClick={() => dismissDiscovery(discovery)}>{t("Not now")}</Button>
        </div>
      </aside>}
      <Disclosure title={t("More ways to practice")} open={practiceOptionsOpen ?? fullNavigation} onOpenChange={setPracticeOptionsOpen} contentClassName="space-y-5">
      <section aria-labelledby="explore-title">
        <h2 id="explore-title" className="mb-3 text-sm font-semibold text-ink">{t("Other options")}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Shortcut title={t("Practice something new")} detail={t("Choose a different situation with the tutor.")} onClick={props.onNewTutor} />
          <Shortcut title={t("Add something I found")} detail={t("Use a phrase or content as a starting point.")} onClick={props.onDiscover} />
          <Shortcut title={t("See my progress")} detail={t("See what improved with help and what you used independently.")} onClick={props.onProgress} />
        </div>
      </section>
      <Button variant="ghost" size="sm" onClick={() => setShowDailyLoop(!showDailyLoop)} aria-expanded={showDailyLoop} aria-controls="daily-card-loop">{showDailyLoop ? t("Hide phrase review") : t("Review my phrases")}</Button>
      {showDailyLoop && <div id="daily-card-loop" className="space-y-5"><Card className="surface-grid-glow overflow-hidden p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wider text-accent">{t("Your daily loop")}</p>
          <div role="group" aria-label={t("Time for today")} className="flex gap-1 rounded-lg border border-line bg-surface p-1">
            {[5, 10, 20].map((value) => <button key={value} type="button" aria-pressed={minutes === value}
              onClick={() => saveLearningProfile({ dailyMinutes: value })}
              className={`min-h-9 rounded px-3 text-xs font-medium transition-colors ${minutes === value ? "bg-accent/10 text-accent" : "text-ink-muted hover:text-ink"}`}>
              {t("{count} min", { count: value })}
            </button>)}
          </div>
        </div>
        {error || dueError ? <Notice tone="error" className="mt-4">{t("Could not load your practice history.")} <Button variant="ghost" onClick={() => void refresh()}>{t("Try again")}</Button></Notice>
          : !ready ? <p role="status" className="mt-5 text-sm text-ink-muted">{t("Loading your day…")}</p>
            : <>
              <h2 className="mt-5 max-w-xl text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                {t(loop.next === "lesson" ? "Start with something you can say today"
                  : loop.next === "review" ? "Make room for what you already learned"
                    : loop.next === "use" ? "Now make the English yours" : "You completed today's loop")}
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">
                {loop.next === "lesson" ? t("One guided lesson: listen, understand, and make your own sentence. No setup needed to begin.")
                  : loop.next === "review" ? t(loop.remaining === 1 ? "Review one phrase. Then use one idea in a new sentence." : "Start with up to {count} due phrases. Then use one idea in a new sentence.", { count: loop.remaining })
                    : loop.next === "use" ? t("Use a saved idea in a different situation. Get feedback, then try a clearer version.")
                      : t("You made time to remember and produce English. The next review will show what stayed. You can stop here.")}
              </p>
              <Button variant="primary" size="lg" className="mt-5 min-h-12 sm:w-auto sm:px-6" onClick={action}>
                {t(loop.next === "lesson" ? "Start first lesson" : loop.next === "review" ? "Start my practice" : loop.next === "use" ? "Use what I learned" : "See my progress")}
                <span aria-hidden="true">→</span>
              </Button>
              <ol aria-label={t("Your daily loop")} className="mt-6 grid gap-3 border-t border-line pt-5 sm:grid-cols-3">
                <LoopStep number={1} title={t("Remember")} done={loop.reviewDone}
                  detail={loop.reviewDone && loop.reviewed === 0 ? t("No review due right now") : t("{count} of up to {total} phrases today", { count: Math.min(loop.reviewed, loop.limit), total: loop.limit })} />
                <LoopStep number={2} title={t("Use it")} done={loop.useDone}
                  detail={t(loop.useDone ? "You made an answer of your own" : "One idea in a new sentence")} />
                <LoopStep number={3} title={t("Let it stick")} done={loop.complete}
                  detail={t(loop.complete ? "Your next reviews are scheduled" : "Review again on another day")} />
              </ol>
            </>}
      </Card>
      {ready && <LearningWins wins={evidence.wins} compact />}
      </div>}
      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <Button variant="ghost" size="sm" onClick={props.onSpeak}>{t("Have a free conversation")}</Button>
        <Button variant="ghost" size="sm" onClick={() => props.onLesson()}>{t("Explore a lesson")}</Button>
        <Button variant="ghost" size="sm" onClick={props.onCorrect}>{t("Work on a correction")}</Button>
        <Button variant="ghost" size="sm" onClick={props.onTools}>Kokoro & Anki</Button>
        <Button variant="ghost" size="sm" onClick={() => setShowPlan(!showPlan)} aria-expanded={showPlan} aria-controls="today-plan">{t(showPlan ? "Hide my plan" : "My longer-term plan")}</Button>
      </div>
      {showPlan && <div id="today-plan"><TodayPlanCard onOpenTask={props.onOpenPlanTask} onCreatePlan={props.onCreatePlan} onInstallDefault={props.onInstallDefaultPlan} /></div>}
      </Disclosure>
    </div>
  );
}

function LoopStep({ number, title, detail, done }: { number: number; title: string; detail: string; done: boolean }) {
  return <li className="flex items-start gap-3">
    <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs ${done ? "border-accent/25 bg-accent/10 text-accent" : "border-line text-ink-muted"}`}>{done ? "✓" : number}</span>
    <div><p className="text-sm font-medium text-ink">{title}</p><p className="mt-1 text-xs leading-relaxed text-ink-muted">{detail}</p></div>
  </li>;
}

function Shortcut({ title, detail, onClick }: { title: string; detail: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="rounded-lg border border-line bg-card p-4 text-left transition-colors hover:border-accent/40 hover:bg-accent/5">
    <span className="flex items-center justify-between gap-2 text-sm font-semibold text-ink">{title}<span aria-hidden="true" className="text-accent">↗</span></span>
    <span className="mt-2 block text-xs leading-relaxed text-ink-muted">{detail}</span>
  </button>;
}
