"use client";

import { createMediaRun, requestActiveMicrophone } from "@/features/converse/mediaRun";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { MicButton } from "@/components/ui/MicButton";
import { useInputLevel } from "@/features/correct/hooks/useInputLevel";
import { cn } from "@/lib/cn";
import { assessPronunciation } from "@/features/pronunciation/api";
import { synthesizeSpeech } from "@/features/converse/api";
import { getPronunciationAttempts, saveAudioRecording, savePronunciationAttempt, saveProductionAttempt } from "@/lib/store/repository";
import type { ProductionAttempt } from "@/lib/performance/types";
import { comparableAttemptPair, RecordingComparison } from "@/features/pronunciation/components/RecordingComparison";
import LocalModelNotice from "@/features/speech/components/LocalModelNotice";
import { useWhisperModel } from "@/features/speech/hooks/useLocalModel";
import { emitActivity } from "@/lib/store/activityLog";
import { useStageTimer } from "@/features/method/useStageTimer";
import { useT } from "@/i18n/I18nProvider";
import { micFallbackAvailable } from "@/features/correct/micFallback";
import type {
  PronunciationAssessment,
  PronunciationAttempt,
  PronunciationWordFeedback,
} from "@/lib/pronunciation/types";

interface PronunciationCoachProps {
  active?: boolean;
  targetText: string;
  targetLang?: string;
  cardId?: string;
  lessonId?: string;
  referenceAudioUrl?: string;
  source: "study" | "lesson" | "c1";
  stage?: "repeat" | "production" | "retry";
  noticedPhraseId?: string;
  onAttemptComplete?: (attempt: { spoken: boolean; text: string }) => void;
  /** Let a learner continue explicitly when the browser denies microphone access. */
  allowTypedFallback?: boolean;
  compact?: boolean;
}

function scoreTone(score: number): string {
  if (score >= 82) return "text-emerald-700 dark:text-emerald-300";
  if (score >= 60) return "text-accent";
  return "text-danger";
}

function wordClass(word: PronunciationWordFeedback): string {
  if (word.status === "match") return "border-emerald-500/30 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300";
  if (word.status === "close") return "border-accent/30 bg-accent/8 text-accent";
  if (word.status === "extra") return "border-line bg-surface text-ink-muted";
  return "border-danger/30 bg-danger/8 text-danger";
}

export function PronunciationCoach({
  active = true,
  targetText,
  targetLang = "en",
  cardId,
  lessonId,
  referenceAudioUrl,
  source,
  stage,
  noticedPhraseId,
  onAttemptComplete,
  allowTypedFallback = false,
  compact = false,
}: PronunciationCoachProps) {
  const { t } = useT();
  const repeatTimer = useStageTimer("repeat", 3, { active });
  // Checking a repeat means transcribing it, so this surface waits on Whisper
  // exactly the way the audio surfaces wait on Kokoro. Showing the install here
  // beats letting Record answer with "model not ready".
  const whisper = useWhisperModel();
  const [recording, setRecording] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const level = useInputLevel(recording ? stream : null);
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    if (!recording) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsedMs(Date.now() - startedAt), 250);
    return () => window.clearInterval(timer);
  }, [recording]);
  const [assessing, setAssessing] = useState(false);
  const [playingReference, setPlayingReference] = useState(false);
  const [previousActive, setPreviousActive] = useState(active);
  if (previousActive !== active) {
    setPreviousActive(active);
    if (!active) {
      setRecording(false);
      setPlayingReference(false);
    }
  }
  const [assessment, setAssessment] = useState<PronunciationAssessment | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [micDenied, setMicDenied] = useState(false);
  const [fallbackText, setFallbackText] = useState("");
  const [fallbackUsed, setFallbackUsed] = useState(false);
  const [history, setHistory] = useState<PronunciationAttempt[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const mediaRun = useRef(createMediaRun());
  const chunksRef = useRef<Blob[]>([]);
  const referenceRef = useRef<HTMLAudioElement | null>(null);
  const referenceUrlRef = useRef<string | null>(null);
  const referenceDurationRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const media = mediaRun.current;
    media.setActive(active);
    return () => {
      media.setActive(false);
      if (recorderRef.current) recorderRef.current.onstop = null;
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      recorderRef.current = null;
      referenceRef.current?.pause();
      if (referenceUrlRef.current) URL.revokeObjectURL(referenceUrlRef.current);
      referenceUrlRef.current = null;
    };
  }, [active]);

  const playReference = useCallback(async () => {
    if (!active) return;
    const run = mediaRun.current.start();
    setNote(null);
    setPlayingReference(true);
    try {
      if (!referenceRef.current) referenceRef.current = new Audio();
      const audio = referenceRef.current;
      audio.pause();
      audio.onended = () => setPlayingReference(false);
      audio.onerror = () => setPlayingReference(false);
      if (referenceAudioUrl) {
        audio.src = referenceAudioUrl;
      } else {
        const blob = await synthesizeSpeech(targetText, run.signal);
        if (!run.current()) return;
        if (referenceUrlRef.current) URL.revokeObjectURL(referenceUrlRef.current);
        referenceUrlRef.current = URL.createObjectURL(blob);
        audio.src = referenceUrlRef.current;
      }
      audio.load();
      await new Promise<void>((resolve) => {
        const done = () => resolve();
        audio.addEventListener("loadedmetadata", done, { once: true });
        audio.addEventListener("error", done, { once: true });
      });
      if (!run.current()) return;
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        referenceDurationRef.current = Math.round(audio.duration * 1000);
      }
      await audio.play();
    } catch (err: unknown) {
      if (!run.current()) return;
      setPlayingReference(false);
      setNote(err instanceof Error ? err.message : t("Couldn't play the reference audio."));
    }
  }, [active, referenceAudioUrl, targetText, t]);

  const assessBlob = useCallback(
    async (blob: Blob) => {
      setAssessing(true);
      setNote(null);
      try {
        const result = await assessPronunciation({
          blob,
          targetText,
          targetLang,
          referenceDurationMs: referenceDurationRef.current,
        });
        setAssessment(result);
        if (!result.transcript) {
          setNote(t("Couldn't make out any speech in that clip."));
          return;
        }
        const attempt: PronunciationAttempt = {
          ...result,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          targetLang,
          cardId,
          lessonId,
          source,
          stage,
          noticedPhraseId,
        };
        const recordingId = crypto.randomUUID();
        attempt.recordingId = recordingId;
        await saveAudioRecording({
          id: recordingId,
          blob,
          mimeType: blob.type || "audio/webm",
          sizeBytes: blob.size,
          createdAt: attempt.createdAt,
        }).catch(() => undefined);
        void savePronunciationAttempt(attempt).catch(() => {});
        const production: ProductionAttempt = {
          id: attempt.id,
          lessonId,
          source: source === "lesson" ? "lesson" : "correct",
          stage,
          noticedPhraseId,
          recordingId,
          prompt: targetText,
          text: result.transcript,
          spoken: true,
          wordCount: result.transcript.split(/\s+/).filter(Boolean).length,
          finished: true,
          issueCount: result.scores.completeness < 80 ? 1 : 0,
          durationMs: result.durationMs,
          createdAt: attempt.createdAt,
        };
        if (stage) void saveProductionAttempt(production).catch(() => {});
        setHistory((current) => [...current, attempt]);
        onAttemptComplete?.({ spoken: true, text: result.transcript });
        // One window per attempt: commit this one, then reopen for the next take.
        // The coach is reused by Repeat, original production, and retry; do not
        // flatten those distinct method stages into repeat in the ledger.
        const methodStage = stage === "production" ? "speak" : stage ?? "repeat";
        const repeatMinutes = repeatTimer.commit();
        repeatTimer.start();
        void emitActivity("method_stage", {
          stage: methodStage,
          area: "speaking",
          source: "pronunciation",
          minutes: repeatMinutes,
          subjectId: cardId ?? lessonId,
        }).catch(() => {});
      } catch (err: unknown) {
        setNote(err instanceof Error ? err.message : t("Pronunciation assessment failed."));
      } finally {
        setAssessing(false);
      }
    },
    [cardId, lessonId, noticedPhraseId, onAttemptComplete, source, stage, targetLang, targetText, t, repeatTimer],
  );

  const startRecording = useCallback(async () => {
    const current = mediaRun.current.checkpoint();
    if (!current()) return;
    setAssessment(null);
    setNote(null);
    setMicDenied(false);
    setFallbackUsed(false);
    try {
      const stream = await requestActiveMicrophone(current);
      if (!stream) return;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (current() && blob.size > 0) void assessBlob(blob);
      };
      recorderRef.current = recorder;
      recorder.start();
      setStream(stream);
      setRecording(true);
    } catch {
      if (!current()) return;
      setMicDenied(true);
      setNote(t("Couldn't access the microphone. Check the browser's permission."));
    }
  }, [assessBlob, t]);

  const completeTypedFallback = () => {
    if (!fallbackText.trim() || fallbackUsed) return;
    setFallbackUsed(true);
    setNote(null);
    const now = Date.now();
    const id = crypto.randomUUID();
    const text = fallbackText.trim();
    const production: ProductionAttempt = {
      id,
      lessonId,
      source: source === "lesson" ? "lesson" : "correct",
      stage,
      noticedPhraseId,
      prompt: targetText,
      text,
      spoken: false,
      wordCount: text.split(/\s+/).filter(Boolean).length,
      finished: true,
      issueCount: 0,
      createdAt: now,
    };
    if (stage) void saveProductionAttempt(production).catch(() => {});
    onAttemptComplete?.({ spoken: false, text });
    const methodStage = stage === "production" ? "speak" : stage ?? "repeat";
    const repeatMinutes = repeatTimer.commit();
    void emitActivity("method_stage", {
      stage: methodStage,
      area: "speaking",
      source: "pronunciation",
      minutes: repeatMinutes,
      subjectId: cardId ?? lessonId,
    }).catch(() => {});
  };

  useEffect(() => {
    if (!cardId && !lessonId) return;
    void getPronunciationAttempts().then((attempts) => {
      setHistory(attempts.filter((attempt) =>
        attempt.targetText === targetText && attempt.lessonId === lessonId && attempt.cardId === cardId,
      ));
    }).catch(() => {});
  }, [cardId, lessonId, targetText]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }, []);

  return (
    <div className={cn("space-y-3 rounded-xl border border-line bg-surface/60 text-left [overflow-wrap:anywhere]", compact ? "p-3" : "p-3 sm:p-4")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-[0.7px] text-ink-muted">{t("Pronunciation")}</p>
          {!compact && (
            <p className="mt-0.5 text-sm text-ink-soft">{t("Listen, repeat, then check what was heard.")}</p>
          )}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void playReference()}
          disabled={playingReference || recording || assessing}
          className="min-h-11 shrink-0 gap-2 rounded-full px-3.5"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="m11 5-6 4H2v6h3l6 4V5Z" /><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
          </svg>
          {playingReference ? t("Playing...") : t("Listen")}
        </Button>
      </div>
      <LocalModelNotice model={whisper} />
      <MicButton
        compact
        recording={recording}
        transcribing={assessing}
        level={level}
        elapsedMs={elapsedMs}
        disabled={assessing || playingReference}
        idleHint={assessment ? t("Try again") : undefined}
        onStart={() => void startRecording()}
        onStop={stopRecording}
      />

      {(allowTypedFallback || micFallbackAvailable({ allowTypedFallback, micDenied })) && !fallbackUsed && (
        <div className="space-y-2 rounded border border-accent/30 bg-accent/5 p-3">
          <p className="text-xs text-ink-soft">
            {t("Prefer typing? Type the phrase once to continue without a microphone.")}
          </p>
          <input
            value={fallbackText}
            onChange={(event) => setFallbackText(event.target.value)}
            aria-label={t("Typed repeat fallback")}
            className="w-full rounded border border-line bg-input px-3 py-2.5 text-base text-ink focus:outline-none focus:ring-2 focus:ring-accent/40 sm:text-sm"
            placeholder={targetText}
          />
          <Button type="button" variant="secondary" size="sm" onClick={completeTypedFallback}>
            {t("Continue with typed repeat")}
          </Button>
        </div>
      )}

      {fallbackUsed && (
        <p className="text-xs text-ink-muted">
          {t("Typed fallback completed. You can continue to your own sentence.")}
        </p>
      )}

      {assessment && (
        <div className="space-y-3" aria-label={t("Latest result")}>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl bg-card p-3">
            <div className="min-w-24">
              <p className="text-xs text-ink-muted">{t("Latest result")}</p>
              <p className={cn("mt-1 text-4xl font-semibold tracking-tight tabular-nums", scoreTone(assessment.scores.overall))}>
                {assessment.scores.overall}<span className="ml-0.5 text-lg font-normal">%</span>
              </p>
            </div>
            <div className="grid min-w-0 flex-1 basis-64 grid-cols-3 gap-3 text-xs">
              <Score label={t("Accuracy")} value={assessment.scores.accuracy} />
              <Score label={t("Completeness")} value={assessment.scores.completeness} />
              <Score label={t("Rhythm")} value={assessment.scores.fluency} />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5" aria-label={t("Word match")}>
            {assessment.words.map((word, index) => (
              <span
                key={`${word.target ?? word.spoken}-${index}`}
                className={cn("rounded-md border px-2 py-1 text-sm", wordClass(word))}
                title={word.status}
              >
                {word.target ?? word.spoken}
              </span>
            ))}
          </div>
          {assessment.transcript && (
            <p className="text-xs leading-relaxed text-ink-muted">{t("Heard: {transcript}", { transcript: assessment.transcript })}</p>
          )}
          {assessment.tips.length > 0 && <ul className="space-y-1 border-l-2 border-accent/50 pl-3 text-sm leading-relaxed text-ink-soft">
            {assessment.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>}
        </div>
      )}

      <RecordingComparison attempts={history} playbackDisabled={!active || recording || assessing || playingReference} />

      {assessment && !comparableAttemptPair(history) && <p className="max-w-prose text-xs leading-relaxed text-ink-muted">
        {t("Use the score to compare your own attempts over time; it does not judge individual sounds or accent.")}
      </p>}

      {note && <p className="text-xs text-danger">{note}</p>}
    </div>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="text-ink-muted">{label}</p>
      <p className={cn("text-lg font-semibold tabular-nums", scoreTone(value))}>{value}%</p>
      <div aria-hidden="true" className="h-1 overflow-hidden rounded-full bg-line">
        <div className={cn("h-full rounded-full bg-current", scoreTone(value))} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}
