"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { useT } from "@/i18n/I18nProvider";
import { buildDeckFromPhrases, firstLesson, lessonById } from "../lessonDeck";
import { getSrs, saveGeneratedDeck, saveProductionAttempt } from "@/lib/store/repository";
import { initialSrs, Rating, type Grade, type SrsRecord } from "@/lib/srs/fsrs";
import { finishLocalProduction, localProduction, type LocalSelfAssessment } from "../localProduction";
import type { ProductionAttempt } from "@/lib/performance/types";
import { emitActivity } from "@/lib/store/activityLog";
import { markFirstRunPhrasesSaved, markFirstRunReviewCompleted } from "@/features/activation/firstRun";

/** A short local entry point. The complete curriculum remains available separately. */
export function QuickLesson({ lessonId, phraseIndex = 0, onBack, onFullLesson }: { lessonId: string; phraseIndex?: number; onBack: () => void; onFullLesson: () => void }) {
  const { t, lang } = useT();
  const lesson = lessonById(lessonId) ?? firstLesson();
  const deck = useMemo(() => buildDeckFromPhrases(`lesson-${lesson.id}`, lesson.phrases, [phraseIndex]), [lesson, phraseIndex]);
  const phrase = lesson.phrases[phraseIndex];
  const card = deck.cards[0];
  const [phase, setPhase] = useState<"produce" | "compare" | "complete">("produce");
  const [srs, setSrs] = useState<SrsRecord>(() => initialSrs(card.id));
  const [answer, setAnswer] = useState("");
  const [attempt, setAttempt] = useState<ProductionAttempt | null>(null);
  const [startedAt] = useState(() => Date.now());
  const [attemptId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const [audioError, setAudioError] = useState(false);

  async function beginRecall() {
    if (saving.current || !answer.trim()) return;
    saving.current = true; setBusy(true); setError(false);
    try {
      const submitted = localProduction(lesson, answer, startedAt, Date.now(), attemptId);
      await saveProductionAttempt(submitted);
      setAttempt(submitted);
      const { added } = await saveGeneratedDeck(deck.cards, deck.candidates);
      const stored = await getSrs(card.id);
      if (stored) setSrs(stored);
      const activation = markFirstRunPhrasesSaved({ sourceId: `lesson-${lesson.id}` });
      void emitActivity("cards_created", { count: added, source: "learn", activation }).catch(() => undefined);
      audio.current?.pause();
      setPhase("compare");
    } catch { setError(true); }
    finally { saving.current = false; setBusy(false); }
  }
  async function finish(grade: Grade, assessment: LocalSelfAssessment) {
    if (saving.current || !attempt) return;
    saving.current = true; setBusy(true); setError(false);
    try {
      const next = await finishLocalProduction(attempt!, assessment, card, srs, grade);
      setSrs(next); setPhase("complete");
      const activation = markFirstRunReviewCompleted();
      void emitActivity("cards_reviewed", { count: 1, cardIds: [card.id], activation }).catch(() => undefined);
    } catch { setError(true); }
    finally { saving.current = false; setBusy(false); }
  }
  return <div className="mx-auto max-w-2xl space-y-5">
    <Button variant="ghost" disabled={busy} onClick={onBack}>{t(phase === "complete" ? "Back to Today" : "Pause and go back")}</Button>
    <PageHeader eyebrow={t("A short practice · about 3 min")} title={t(phase === "complete" ? "You completed a short practice" : "Your own answer first")} description={t(lesson.topic)} />
    <ol aria-label={t("Session steps")} className="flex flex-wrap gap-3 text-xs text-ink-muted">
      {["Try in your own words", "Compare with examples", "Keep it for later"].map((label, index) => <li key={label} aria-current={index === ["produce", "compare", "complete"].indexOf(phase) ? "step" : undefined} className="rounded-lg border border-line px-3 py-2 aria-[current=step]:border-accent/40 aria-[current=step]:text-accent">{index + 1}. {t(label)}</li>)}
    </ol>
    {error && <Notice tone="error">{t("Your answer could not be saved. Try again before moving on.")}</Notice>}
    {phase === "produce" && <Card className="space-y-5 p-6">
      <p className="text-base text-ink">{t(lesson.productionPrompt ?? "Write a short message for a colleague about this topic.")}</p>
      <p className="text-sm text-ink-soft">{t("Try before looking at an example. A short answer is enough to start.")}</p>
      <label className="block space-y-2 text-sm text-ink"><span>{t("Your answer in English")}</span><textarea className="w-full rounded-lg border border-line bg-surface p-3" rows={4} lang="en" value={answer} maxLength={3000} disabled={busy} onChange={e => setAnswer(e.target.value)} /></label>
      <Button disabled={busy || !answer.trim()} onClick={() => void beginRecall()}>{t(busy ? "Saving…" : "Save my answer and compare")}</Button>
    </Card>}
    {phase === "compare" && <Card className="space-y-5 p-6">
      <div><h2 className="font-medium text-ink">{t("Your answer")}</h2><p className="mt-2 whitespace-pre-wrap text-sm text-ink" lang="en">{attempt?.text}</p></div>
      <h3 className="font-medium text-ink">{t("Examples from the lesson")}</h3>
      {(lesson.dialogue?.length ? lesson.dialogue : lesson.phrases.slice(0, 4)).map((line, i) => <div key={i}><p className="text-sm text-ink" lang="en">{line.en}</p><p className="text-xs text-ink-soft" lang="pt-BR">{line.pt}</p></div>)}
      <audio ref={audio} src={phrase.clip} preload="none" />
      <Button variant="secondary" onClick={() => { setAudioError(false); void audio.current?.play().catch(() => setAudioError(true)); }}>{t("Listen")}</Button>
      {audioError && <Notice>{t("Audio is unavailable. You can keep practicing with the text.")}</Notice>}
      <p className="text-sm text-ink-soft">{t("Different wording can work. How did your answer communicate the goal? This is your own assessment, not a checked result.")}</p>
      <div className="flex flex-wrap gap-2">{([[Rating.Again, "needs_practice", "I need more practice"], [Rating.Hard, "partly", "I communicated part of it"], [Rating.Good, "communicated", "I communicated what I wanted"]] as const).map(([grade, assessment, label]) => <Button key={assessment} variant="secondary" disabled={busy} onClick={() => void finish(grade, assessment)}>{t(label)}</Button>)}</div>
    </Card>}
    {phase === "complete" && <Card className="space-y-4 border-accent/25 p-6">
      <h2 className="text-xl font-semibold text-ink">{t("Your phrase and attempt are saved")}</h2>
      <p className="text-sm leading-relaxed text-ink-soft">{t("You wrote before comparing and saved your own assessment. Try again another day; this practice does not confirm a checked success.")}</p>
      <p className="text-sm text-ink-soft">{t("Next phrase review:")} {new Date(srs.due).toLocaleString(lang === "pt" ? "pt-BR" : "en-US")}</p>
      <Button variant="primary" onClick={onBack}>{t("Finish for today")}</Button>
      <div className="border-t border-line pt-3"><Button variant="ghost" onClick={onFullLesson}>{t("Explore the full lesson")}</Button></div>
    </Card>}
  </div>;
}
