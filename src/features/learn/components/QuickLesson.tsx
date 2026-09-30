"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { useT } from "@/i18n/I18nProvider";
import { buildDeckFromPhrases, firstLesson, lessonById } from "../lessonDeck";
import { getSrs, saveGeneratedDeck } from "@/lib/store/repository";
import { initialSrs, type Grade, type SrsRecord } from "@/lib/srs/fsrs";
import { StudyCard, type ScaffoldTelemetry } from "@/features/study/components/StudyCard";
import { recordQuickPractice } from "../quickPractice";
import { emitActivity } from "@/lib/store/activityLog";
import { markFirstRunPhrasesSaved, markFirstRunReviewCompleted } from "@/features/activation/firstRun";

/** A short local entry point. The complete curriculum remains available separately. */
export function QuickLesson({ lessonId, phraseIndex = 0, onBack, onFullLesson }: { lessonId: string; phraseIndex?: number; onBack: () => void; onFullLesson: () => void }) {
  const { t, lang } = useT();
  const lesson = lessonById(lessonId) ?? firstLesson();
  const deck = useMemo(() => buildDeckFromPhrases(`lesson-${lesson.id}`, lesson.phrases, [phraseIndex]), [lesson, phraseIndex]);
  const phrase = lesson.phrases[phraseIndex];
  const card = deck.cards[0];
  const [phase, setPhase] = useState<"learn" | "recall" | "complete">("learn");
  const [srs, setSrs] = useState<SrsRecord>(() => initialSrs(card.id));
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const [audioError, setAudioError] = useState(false);

  async function beginRecall() {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError(false);
    try {
      const { added } = await saveGeneratedDeck(deck.cards, deck.candidates);
      const stored = await getSrs(card.id);
      if (stored) setSrs(stored);
      const activation = markFirstRunPhrasesSaved({ sourceId: `lesson-${lesson.id}` });
      void emitActivity("cards_created", { count: added, source: "learn", activation }).catch(() => undefined);
      audio.current?.pause();
      setPhase("recall");
    } catch { setError(true); }
    finally { saving.current = false; setBusy(false); }
  }
  async function finish(grade: Grade, telemetry: ScaffoldTelemetry) {
    if (saving.current) return;
    saving.current = true; setBusy(true); setError(false);
    try {
      // The example was just shown: this is supported practice, never independent recall.
      const { next } = await recordQuickPractice(card, srs, grade, telemetry);
      setSrs(next); setPhase("complete");
      const activation = markFirstRunReviewCompleted();
      void emitActivity("cards_reviewed", { count: 1, cardIds: [card.id], activation }).catch(() => undefined);
    } catch { setError(true); }
    finally { saving.current = false; setBusy(false); }
  }
  return <div className="mx-auto max-w-2xl space-y-5">
    <Button variant="ghost" disabled={busy} onClick={onBack}>{t(phase === "complete" ? "Back to Today" : "Pause and go back")}</Button>
    <PageHeader eyebrow={t("A short practice · about 3 min")} title={t(phase === "complete" ? "You completed a short practice" : "One useful phrase")} description={t(lesson.topic)} />
    <ol aria-label={t("Session steps")} className="flex flex-wrap gap-3 text-xs text-ink-muted">
      {["See the phrase", "Try remembering", "Keep it for later"].map((label, index) => <li key={label} aria-current={index === ["learn", "recall", "complete"].indexOf(phase) ? "step" : undefined} className="rounded-lg border border-line px-3 py-2 aria-[current=step]:border-accent/40 aria-[current=step]:text-accent">{index + 1}. {t(label)}</li>)}
    </ol>
    {error && <Notice tone="error">{t("Your answer could not be saved. Try again before moving on.")}</Notice>}
    {phase === "learn" && <Card className="space-y-5 p-6">
      <p className="text-xl font-semibold text-ink" lang="en">{phrase.en}</p>
      <p className="text-sm text-ink-soft" lang="pt-BR">{phrase.pt}</p>
      <audio ref={audio} src={phrase.clip} preload="none" />
      <Button variant="secondary" onClick={() => { setAudioError(false); void audio.current?.play().catch(() => setAudioError(true)); }}>{t("Listen")}</Button>
      {audioError && <Notice>{t("Audio is unavailable. You can keep practicing with the text.")}</Notice>}
      <p className="text-sm text-ink-muted">{t("Read it once. Next, the English disappears so you can try remembering it.")}</p>
      <Button variant="primary" disabled={busy} onClick={() => void beginRecall()}>{t(busy ? "Saving…" : "I'm ready to try")}</Button>
    </Card>}
    {phase === "recall" && <>
      <p className="text-sm text-ink-muted">{t("Try the phrase you just saw. After comparing, tell us how remembering felt.")}</p>
      <StudyCard totalCards={2} current={{ card, srs }} queueLength={1} flipped={flipped} grading={busy} sessionResults={[]} tomorrow={null} reviews={[]}
        onFlip={() => setFlipped(true)} onGrade={(grade, telemetry) => void finish(grade, telemetry)} onDiscover={onFullLesson} />
    </>}
    {phase === "complete" && <Card className="space-y-4 border-accent/25 p-6">
      <h2 className="text-xl font-semibold text-ink">{t("Your phrase and attempt are saved")}</h2>
      <p className="text-sm leading-relaxed text-ink-soft">{t("You practiced with a recent example. Remembering on another day is the next step.")}</p>
      <p className="text-sm text-ink-soft">{t("Next phrase review:")} {new Date(srs.due).toLocaleString(lang === "pt" ? "pt-BR" : "en-US")}</p>
      <Button variant="primary" onClick={onBack}>{t("Finish for today")}</Button>
      <div className="border-t border-line pt-3"><Button variant="ghost" onClick={onFullLesson}>{t("Explore the full lesson")}</Button></div>
    </Card>}
  </div>;
}
