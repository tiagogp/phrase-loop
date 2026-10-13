"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { useT } from "@/i18n/I18nProvider";
import { useExperiencePreferences, setFullNavigation } from "@/features/activation/experiencePreferences";

export interface ExploreActions {
  onTutor: () => void;
  onLesson: () => void;
  onSpeak: () => void;
  onCorrect: () => void;
  onDiscover: () => void;
  onReview: () => void;
  onFocus: () => void;
  onProgress: () => void;
  onPlan: () => void;
  onC1: () => void;
  onTools: (tool: string) => void;
}

export function ExploreHome(props: ExploreActions) {
  const { t } = useT();
  const { fullNavigation } = useExperiencePreferences();
  const groups = [
    { title: "Practice", items: [
      ["Practice a situation", "One answer, focused feedback, and another attempt.", props.onTutor],
      ["Guided lessons", "Learn useful phrases, listen, and make an answer of your own.", props.onLesson],
      ["Conversation and speaking", "Role-play a situation or warm up with guided speaking.", props.onSpeak],
      ["Improve a text", "Bring an answer and work on one useful correction.", props.onCorrect],
      ["Review my phrases", "Recall what you saved, one phrase at a time.", props.onReview],
      ["Practice a theme", "Create phrases for a situation you choose.", () => props.onTools("themes")],
    ] },
    { title: "Bring your content", items: [
      ["Add a phrase or source", "Keep a phrase, or import a video, article, or PDF.", props.onDiscover],
    ] },
    { title: "Follow your learning", items: [
      ["My progress", "See your answers and what changed with practice.", props.onProgress],
      ["Difficulties and checks", "Reinforcement, listening, delayed recall, and level readiness.", props.onFocus],
      ["My goal and plan", "See the activities behind your next practice.", props.onPlan],
      ["Advanced writing · C1", "Explore register and naturalness with an experimental diagnosis.", props.onC1],
    ] },
    { title: "Tools", items: [
      ["Export to Anki", "Take your saved phrases and audio with you.", () => props.onTools("anki")],
      ["Generate audio", "Listen to English text with a voice you choose.", () => props.onTools("audio")],
    ] },
  ] as const;
  return <div className="mx-auto max-w-5xl space-y-8">
    <PageHeader title={t("Explore")} description={t("Choose something specific. Today always has a practice ready for you.")} />
    {groups.map(group => <section key={group.title} className="space-y-3">
      <h2 className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">{t(group.title)}<span aria-hidden="true" className="h-px flex-1 bg-line" /></h2>
      <div className="grid gap-3 sm:grid-cols-2">{group.items.map(([title, detail, action]) => <button key={title} type="button" onClick={action}
        className="group flex min-w-0 flex-col rounded-xl border border-line bg-card p-5 text-left transition-colors hover:border-accent/40 hover:bg-accent/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        <span className="flex w-full items-center justify-between gap-4 text-base font-semibold tracking-tight text-ink">{t(title)}<span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-ink-muted transition-colors group-hover:bg-accent/10 group-hover:text-accent">→</span></span>
        <span className="mt-2 block max-w-md text-sm leading-relaxed text-ink-soft">{t(detail)}</span>
      </button>)}</div>
    </section>)}
    <div className="rounded-xl border border-line bg-surface p-4"><Button variant="secondary" aria-pressed={fullNavigation} onClick={() => setFullNavigation(!fullNavigation)}>{t(fullNavigation ? "Use simple navigation" : "Show all shortcuts")}</Button>
      <p className="mt-2 text-xs text-ink-muted">{t("Shortcuts change the navigation only. Today stays focused.")}</p></div>
  </div>;
}
