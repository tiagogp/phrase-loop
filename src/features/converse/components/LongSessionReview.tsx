"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { Spinner } from "@/components/ui/Spinner";
import { useT } from "@/i18n/I18nProvider";
import { cn } from "@/lib/cn";
import { saveGeneratedDeck, type Conversation } from "@/lib/store/repository";
import { transcribeAudio } from "@/features/correct/api";
import { buildGapPhrase } from "@/features/converse/gapPhrase";
import { codeSwitchStats, type LongSessionTopic } from "@/features/converse/longSession";
import type { ReviewedGap } from "@/features/converse/gapReview";
import type { ConversationGap } from "@/features/converse/gaps";
import { useClipRecorder } from "@/features/converse/useClipRecorder";

export interface LongSessionReviewProps {
  conversation: Conversation;
  topic?: LongSessionTopic;
  /** The gap registry, to mark recurring patterns and list gaps closed in this session. */
  registry?: ConversationGap[];
  reviewing: boolean;
  /** Where the review is sent, so the learner knows when it leaves the device. */
  reviewerNote?: string | null;
  note?: string | null;
  onRetry: () => void;
  onUpdate: (next: Conversation) => void;
  onDone: () => void;
  /** Opens a tutor situation from a saved phrase (the existing source-card bridge). */
  onPracticeSource?: (cardId: string) => void;
}

const KIND_LABEL: Record<ReviewedGap["kind"], string> = {
  code_switch: "You switched to Portuguese",
  avoidance: "You went around it",
  unnatural: "Understood, but not natural yet",
  error: "Changed the message",
};

export function LongSessionReview({ conversation, topic, registry = [], reviewing, reviewerNote, note, onRetry, onUpdate, onDone, onPracticeSource }: LongSessionReviewProps) {
  const { t } = useT();
  const long = conversation.longSession;
  const review = long?.review;
  const stats = codeSwitchStats(conversation.turns);
  const learnerTurns = conversation.turns.filter((turn) => turn.role === "user").length;
  const closedHere = registry.filter((gap) => (long?.closedGapIds ?? []).includes(gap.id));
  const recurring = (label: string) => {
    const known = registry.find((gap) => gap.patternLabel === label);
    return Boolean(known && known.sessionIds.length > 1 && known.sessionIds.includes(conversation.id));
  };
  return (
    <div className="space-y-5">
      <Card className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-[-0.01em] text-ink">{t("Review")} · {long?.label ?? conversation.context}</p>
            <p className="text-xs text-ink-muted">
              {t("{count} of your turns", { count: learnerTurns })}
              {" · "}
              {t("Stuck {count} times · {seconds}s in Portuguese", { count: stats.count, seconds: stats.recordedSeconds })}
            </p>
          </div>
          <Button variant="secondary" className="h-9 shrink-0" onClick={onDone}>{t("Done")}</Button>
        </div>
        {reviewerNote && <p className="text-xs text-ink-muted">{reviewerNote}</p>}

        {closedHere.length > 0 && (
          <Notice tone="success" className="space-y-1">
            <p className="font-medium text-ink">{t("You said it on your own this time")}</p>
            <ul className="space-y-1 text-sm">
              {closedHere.map((gap) => (
                <li key={gap.id}>
                  <span lang="en" className="text-ink">{gap.history.findLast((event) => event.type === "closed" && event.sessionId === conversation.id)?.evidence}</span>
                  <span className="text-xs text-ink-muted"> · {t("first stuck on:")} {gap.history[0]?.evidence ?? gap.evidence}</span>
                </li>
              ))}
            </ul>
          </Notice>
        )}

        {reviewing ? (
          <p className="flex items-center gap-2 text-sm text-ink-muted"><Spinner className="h-4 w-4" /> {t("Reading the whole conversation…")}</p>
        ) : !review ? (
          <div className="space-y-2">
            {note && <p className="text-xs text-danger">{note}</p>}
            <Button variant="primary" className="h-10" onClick={onRetry}>{t("Review my session →")}</Button>
          </div>
        ) : (
          <>
            {review.malformed && (
              <Notice tone="warning" className="space-y-2">
                <p>{t("The review came back in a format I could not read. Nothing was lost; you can try again.")}</p>
                <Button variant="secondary" onClick={onRetry}>{t("Try the review again")}</Button>
              </Notice>
            )}
            {review.strengths.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-ink-muted">{t("What worked")}</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
                  {review.strengths.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </div>
            )}
            {!review.malformed && review.gaps.length === 0 && (
              <p className="rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink-soft">
                {t("No gap with a real sentence came up this time. Try a longer session or a harder scenario.")}
              </p>
            )}
            {review.gaps.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-ink">{t("What you could not say yet")}</p>
                {review.gaps.map((gap, index) => (
                  <GapCard key={`${gap.patternLabel}-${index}`} gap={gap} recurring={recurring(gap.patternLabel)} topic={topic} conversationId={conversation.id} onPracticeSource={onPracticeSource} />
                ))}
              </div>
            )}
            {review.gaps.length > 0 && <Reconstruction conversation={conversation} onUpdate={onUpdate} />}
          </>
        )}
      </Card>
    </div>
  );
}

function GapCard({ gap, recurring, topic, conversationId, onPracticeSource }: { gap: ReviewedGap; recurring: boolean; topic?: LongSessionTopic; conversationId: string; onPracticeSource?: (cardId: string) => void }) {
  const { t } = useT();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const functionLabel = topic?.functions?.find((item) => item.id === gap.functionId)?.label;

  const save = useCallback(async (practice: boolean) => {
    setSaving(true);
    setError(null);
    try {
      const phrase = await buildGapPhrase(gap, conversationId);
      await saveGeneratedDeck(phrase.cards, [phrase.candidate]);
      setSaved(phrase.candidate.id);
      if (practice) onPracticeSource?.(phrase.candidate.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("Couldn't save the phrase."));
    } finally {
      setSaving(false);
    }
  }, [conversationId, gap, onPracticeSource, t]);

  return (
    <article className="space-y-2 rounded-lg border border-line p-4 [overflow-wrap:anywhere]">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded border border-accent/30 px-1.5 py-0.5 text-[0.65rem] font-medium text-accent">{t(KIND_LABEL[gap.kind])}</span>
        {recurring && <span className="rounded border border-warning px-1.5 py-0.5 text-[0.65rem] font-medium text-ink">{t("Came up again")}</span>}
        {functionLabel && <span className="rounded border border-line px-1.5 py-0.5 text-[0.65rem] text-ink-muted">{functionLabel}</span>}
        <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[0.65rem] text-ink-muted">{gap.patternLabel}</span>
      </div>
      {gap.askedIn && <p className="text-xs text-ink-muted">{t("Your partner asked:")} <q lang="en">{gap.askedIn}</q></p>}
      <p className="text-sm text-ink-soft">
        {gap.kind === "code_switch" ? t("You said in Portuguese:") : t("You said:")}{" "}
        <q lang={gap.kind === "code_switch" ? "pt" : "en"} className="text-ink">{gap.evidence}</q>
      </p>
      <p className="text-sm text-ink-soft">{t("What you meant:")} {gap.intent}</p>
      <dl className="grid gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-3">
        <dt className="text-xs font-medium text-ink-muted">{t("Casual")}</dt>
        <dd lang="en" className="text-ink">{gap.natural.casual}</dd>
        <dt className="text-xs font-medium text-ink-muted">{t("Neutral")}</dt>
        <dd lang="en" className="text-ink">{gap.natural.neutral}</dd>
      </dl>
      {gap.why && <p className="text-xs text-ink-muted">{gap.why}</p>}
      <div className="flex flex-wrap gap-2 pt-1">
        {onPracticeSource && (
          <Button variant="secondary" disabled={saving} onClick={() => void save(true)}>{t("Practice it in a tutor situation")}</Button>
        )}
        <Button variant="ghost" disabled={saving || Boolean(saved)} onClick={() => void save(false)}>
          {saved ? t("Phrase saved for review and Anki") : t("Save as a phrase")}
        </Button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </article>
  );
}

/**
 * The review ends with the learner saying each gap again with the natural form. The attempt is
 * kept next to the session and compared with the natural version; it is not graded.
 */
function Reconstruction({ conversation, onUpdate }: { conversation: Conversation; onUpdate: (next: Conversation) => void }) {
  const { t } = useT();
  const gaps = conversation.longSession?.review?.gaps ?? [];
  const attempts = conversation.longSession?.reconstructions ?? [];
  const [drafts, setDrafts] = useState<Record<number, { text: string; spoken: boolean }>>({});
  const [activeGap, setActiveGap] = useState<number | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const mic = useClipRecorder(true);

  const record = useCallback(async (index: number) => {
    setNote(null);
    if (mic.recording) {
      const clip = await mic.stop();
      setActiveGap(null);
      if (!clip) return;
      setTranscribing(true);
      try {
        const text = await transcribeAudio(clip.blob);
        if (text) setDrafts((prev) => ({ ...prev, [index]: { text, spoken: true } }));
        else setNote(t("Couldn't make out any speech in that clip."));
      } catch (err: unknown) {
        setNote(err instanceof Error ? err.message : t("Transcription failed."));
      } finally {
        setTranscribing(false);
      }
      return;
    }
    try {
      if (await mic.start()) setActiveGap(index);
    } catch {
      setNote(t("Couldn't access the microphone. Check the browser's permission."));
    }
  }, [mic, t]);

  const keep = useCallback((index: number) => {
    const draft = drafts[index];
    if (!draft?.text.trim() || !conversation.longSession) return;
    onUpdate({
      ...conversation,
      longSession: {
        ...conversation.longSession,
        reconstructions: [...attempts, { gapIndex: index, text: draft.text.trim(), spoken: draft.spoken, at: Date.now() }],
      },
    });
    setDrafts((prev) => ({ ...prev, [index]: { text: "", spoken: false } }));
  }, [attempts, conversation, drafts, onUpdate]);

  return (
    <section className="space-y-3 rounded-lg border border-accent/30 bg-accent/5 p-4">
      <div>
        <p className="text-sm font-medium text-ink">{t("Now say it again, out loud")}</p>
        <p className="mt-1 text-xs text-ink-soft">{t("Rebuild what you wanted to say with the natural form, in your own sentence. This is practice: it is saved, not graded.")}</p>
      </div>
      {note && <p className="text-xs text-danger">{note}</p>}
      {gaps.map((gap, index) => {
        const last = attempts.filter((attempt) => attempt.gapIndex === index).at(-1);
        const draft = drafts[index] ?? { text: "", spoken: false };
        return (
          <div key={index} className="space-y-2 border-t border-line pt-3 first:border-t-0 first:pt-0">
            <p className="text-xs text-ink-muted">{gap.intent}</p>
            <textarea
              value={draft.text}
              rows={2}
              lang="en"
              onChange={(event) => setDrafts((prev) => ({ ...prev, [index]: { text: event.target.value, spoken: false } }))}
              placeholder={t("Say or write it again…")}
              aria-label={t("Say or write it again…")}
              className="w-full resize-y rounded border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={transcribing || (mic.recording && activeGap !== index)}
                className={cn(mic.recording && activeGap === index && "border-danger text-danger")}
                onClick={() => void record(index)}>
                {transcribing && activeGap === null ? <Spinner className="h-4 w-4" /> : mic.recording && activeGap === index ? t("Stop") : t("Say it")}
              </Button>
              <Button variant="primary" disabled={!draft.text.trim()} onClick={() => keep(index)}>{t("Keep this attempt")}</Button>
            </div>
            {last && (
              <dl className="grid gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-3">
                <dt className="text-xs font-medium text-ink-muted">{t("You")}</dt>
                <dd lang="en" className="text-ink">{last.text}</dd>
                <dt className="text-xs font-medium text-ink-muted">{t("Natural")}</dt>
                <dd lang="en" className="text-ink-soft">{gap.natural.neutral}</dd>
              </dl>
            )}
          </div>
        );
      })}
    </section>
  );
}
