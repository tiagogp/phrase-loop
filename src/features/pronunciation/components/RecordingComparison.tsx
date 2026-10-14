"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/I18nProvider";
import { getAudioRecording } from "@/lib/store/repository";
import { cn } from "@/lib/cn";
import { RecordingPlayer } from "./RecordingPlayer";
import type { PronunciationAttempt } from "@/lib/pronunciation/types";

export function comparableAttemptPair(attempts: PronunciationAttempt[]): {
  earlier: PronunciationAttempt;
  later: PronunciationAttempt;
} | null {
  const groups = new Map<string, PronunciationAttempt[]>();
  for (const attempt of attempts) {
    if (!attempt.recordingId) continue;
    // Compare like with like: a later recording only says something useful when it
    // answers the same prompt/phrase, not merely because it is newer.
    const key = [
      attempt.targetText.trim().toLowerCase(),
      attempt.lessonId ?? "",
      attempt.cardId ?? "",
      attempt.noticedPhraseId ?? "",
    ].join("\u0000");
    const group = groups.get(key) ?? [];
    group.push(attempt);
    groups.set(key, group);
  }
  const comparable = [...groups.values()]
    .filter((group) => group.length >= 2)
    .sort((left, right) => {
      const latestLeft = Math.max(...left.map((attempt) => attempt.createdAt));
      const latestRight = Math.max(...right.map((attempt) => attempt.createdAt));
      return right.length - left.length || latestRight - latestLeft;
    })[0]
    ?.sort((a, b) => a.createdAt - b.createdAt);
  if (!comparable) return null;
  return { earlier: comparable[0], later: comparable[comparable.length - 1] };
}

function signedDelta(value: number): string {
  return `${value >= 0 ? "+" : ""}${value}`;
}

function seconds(durationMs?: number): string {
  return durationMs == null ? "—" : `${(durationMs / 1000).toFixed(1)}s`;
}

/**
 * A deliberately descriptive comparison: it shows two samples and their evidence,
 * without claiming that the later sample caused the score change.
 */
export function RecordingComparison({ attempts, playbackDisabled = false }: { attempts: PronunciationAttempt[]; playbackDisabled?: boolean }) {
  const { t } = useT();
  const pair = comparableAttemptPair(attempts);
  const earlier = pair?.earlier;
  const later = pair?.later;
  const earlierId = earlier?.id;
  const laterId = later?.id;
  const earlierRecordingId = earlier?.recordingId;
  const laterRecordingId = later?.recordingId;
  const [urls, setUrls] = useState<{ earlierId?: string; laterId?: string; earlier?: string; later?: string }>({});

  useEffect(() => {
    let cancelled = false;
    const ownedUrls: string[] = [];
    const load = async () => {
      const entries = await Promise.all(
        [earlierRecordingId, laterRecordingId].map(async (recordingId) => {
          if (!recordingId) return undefined;
          const recording = await getAudioRecording(recordingId).catch(() => undefined);
          if (cancelled || !recording) return undefined;
          const url = URL.createObjectURL(recording.blob);
          ownedUrls.push(url);
          return url;
        }),
      );
      if (!cancelled) setUrls({ earlierId, laterId, earlier: entries[0], later: entries[1] });
    };
    void load();
    return () => {
      cancelled = true;
      ownedUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [earlierId, laterId, earlierRecordingId, laterRecordingId]);

  if (!earlier || !later) return null;
  const loaded = urls.earlierId === earlierId && urls.laterId === laterId;
  const overallChange = later.scores.overall - earlier.scores.overall;

  return (
    <section aria-label={t("Compare attempts")} className="space-y-2 border-t border-line pt-3 text-left"
      onPlayCapture={(event) => {
        // Listening to the second take should never mix it with the first.
        event.currentTarget.querySelectorAll("audio").forEach((audio) => {
          if (audio !== event.target) audio.pause();
        });
      }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">{t("Compare attempts")}</h3>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium tabular-nums",
          overallChange > 0 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-card text-ink-soft")}>
          {t("{change} pts overall", { change: signedDelta(overallChange) })}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {([
          ["Earlier", earlier, loaded ? urls.earlier : undefined],
          ["Latest", later, loaded ? urls.later : undefined],
        ] as const).map(([label, attempt, url]) => (
          <div key={label} className="min-w-0 space-y-2 rounded-xl border border-line bg-card p-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-xs font-medium text-ink-muted">{t(label)}</h4>
              <p className="text-xl font-semibold tabular-nums tracking-tight text-ink">
                <span className="sr-only">{t("Overall")} </span>{attempt.scores.overall}<span className="ml-0.5 text-xs font-normal text-ink-muted">%</span>
              </p>
            </div>
            {url
              ? <RecordingPlayer key={url} audioUrl={url} label={t(label)} durationMs={attempt.durationMs} disabled={playbackDisabled} />
              : <p role="status" className="py-3 text-xs text-ink-muted">{t(loaded ? "Audio is no longer available." : "Loading recording…")}</p>}
            <p className="text-sm leading-relaxed text-ink-soft [overflow-wrap:anywhere]">{attempt.transcript || t("No transcript")}</p>
            <dl className="flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-2 text-xs">
              <div><dt className="text-ink-muted">{t("Completeness")}</dt><dd className="mt-1 font-medium tabular-nums text-ink-soft">{attempt.scores.completeness}%</dd></div>
              <div><dt className="text-ink-muted">{t("Rhythm")}</dt><dd className="mt-1 font-medium tabular-nums text-ink-soft">{attempt.scores.fluency}%</dd></div>
              <div><dt className="text-ink-muted">{t("Duration")}</dt><dd className="mt-1 font-medium tabular-nums text-ink-soft">{seconds(attempt.durationMs)}</dd></div>
            </dl>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs leading-relaxed text-ink-muted">
        <span>{t("Completeness")} <span className="font-medium tabular-nums text-ink-soft">{signedDelta(later.scores.completeness - earlier.scores.completeness)}</span></span>
        <span>{t("Rhythm")} <span className="font-medium tabular-nums text-ink-soft">{signedDelta(later.scores.fluency - earlier.scores.fluency)}</span></span>
        <span>{t("Duration")} <span className="tabular-nums text-ink-soft">{seconds(earlier.durationMs)} → {seconds(later.durationMs)}</span></span>
      </div>
      <p className="max-w-prose text-xs leading-relaxed text-ink-muted">
        {t("Comparison is based on the transcript and recording length, not individual sounds or accent.")}
      </p>
    </section>
  );
}
