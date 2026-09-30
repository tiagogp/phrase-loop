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
  return <div className="space-y-8">
    <PageHeader title={t("Explore")} description={t("Choose something specific. Today always has a practice ready for you.")} />
    {groups.map(group => <section key={group.title} className="space-y-3">
      <h2 className="text-sm font-semibold text-ink">{t(group.title)}</h2>
      <div className="grid gap-3 sm:grid-cols-2">{group.items.map(([title, detail, action]) => <button key={title} type="button" onClick={action}
        className="rounded-lg border border-line bg-card p-4 text-left transition-colors hover:border-accent/40 focus-visible:outline-2 focus-visible:outline-accent">
        <span className="flex justify-between gap-3 font-medium text-ink">{t(title)}<span aria-hidden="true">→</span></span>
        <span className="mt-2 block text-sm leading-relaxed text-ink-muted">{t(detail)}</span>
      </button>)}</div>
    </section>)}
    <div className="border-t border-line pt-4"><Button variant="ghost" onClick={() => setFullNavigation(!fullNavigation)}>{t(fullNavigation ? "Use simple navigation" : "Show all shortcuts")}</Button>
      <p className="mt-2 text-xs text-ink-muted">{t("Shortcuts change the navigation only. Today stays focused.")}</p></div>
  </div>;
}
