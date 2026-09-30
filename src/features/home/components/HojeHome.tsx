"use client";

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
import { TutorHomeCard } from "@/features/tutor/components/TutorHomeCard";

interface HojeHomeProps {
  onTutor: () => void;
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
  const { data, evidence, loading, error, refresh, now } = useLearningEvidence();
  const [due, setDue] = useState<number | null>(null);
  const [dueError, setDueError] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
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
      <PageHeader eyebrow={t("A little English, put to use")} title={t("Today")}
        description={t("Remember a little. Say something of your own. Come back and see what stayed.")} />
      <TutorHomeCard onOpen={props.onTutor} />
      <Card className="surface-grid-glow overflow-hidden p-5 sm:p-7">
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
      <section aria-labelledby="explore-title">
        <h2 id="explore-title" className="mb-3 text-sm font-semibold text-ink">{t("Make it relevant to your life")}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Shortcut title={t("Conversation")} detail={t("Rehearse a situation you actually need.")} onClick={props.onSpeak} />
          <Shortcut title={t("Add content")} detail={t("Turn your videos, articles, and phrases into practice.")} onClick={props.onDiscover} />
          <Shortcut title={t("Kokoro & Anki")} detail={t("Create audio and take your phrases to Anki.")} onClick={props.onTools} />
        </div>
      </section>
      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <Button variant="ghost" size="sm" onClick={() => props.onLesson()}>{t("Explore a lesson")}</Button>
        <Button variant="ghost" size="sm" onClick={props.onCorrect}>{t("Work on a correction")}</Button>
        <Button variant="ghost" size="sm" onClick={() => setShowPlan(!showPlan)} aria-expanded={showPlan} aria-controls="today-plan">{t(showPlan ? "Hide my plan" : "My longer-term plan")}</Button>
      </div>
      {showPlan && <div id="today-plan"><TodayPlanCard onOpenTask={props.onOpenPlanTask} onCreatePlan={props.onCreatePlan} onInstallDefault={props.onInstallDefaultPlan} /></div>}
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
