"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { Button } from "@/components/ui/Button";
import { useAudioState } from "@/features/speech/hooks/useAudioState";
import { useT } from "@/i18n/I18nProvider";
import styles from "./RecordingPlayer.module.css";

/** Compact playback for a saved take. Mount with a source key to reset playback. */
export function RecordingPlayer({ audioUrl, label, durationMs, disabled = false }: {
  audioUrl: string;
  label: string;
  durationMs?: number;
  disabled?: boolean;
}) {
  const { t } = useT();
  const audioRef = useRef<HTMLAudioElement>(null);
  const { state, error, formatTime, audioHandlers, togglePlay } = useAudioState(audioRef);
  useEffect(() => {
    if (disabled) audioRef.current?.pause();
  }, [disabled]);
  // MediaRecorder WebM blobs can report Infinity until played. The saved
  // recording length keeps seeking and the time label useful in that case.
  const duration = state.duration > 0 && Number.isFinite(state.duration)
    ? state.duration
    : Math.max(0, (durationMs ?? 0) / 1000);
  const currentTime = Math.min(state.currentTime, duration);
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const updateDuration = () => {
    if (Number.isFinite(audioRef.current?.duration)) audioHandlers.onLoadedMetadata();
  };

  return (
    <div className="min-w-0">
      <audio ref={audioRef} src={audioUrl} preload="metadata" {...audioHandlers}
        onLoadedMetadata={updateDuration} onDurationChange={updateDuration} />
      <div className="flex items-center gap-3">
        <Button variant="secondary" className="h-11 w-11 shrink-0 rounded-full p-0"
          onClick={togglePlay} disabled={disabled} aria-label={t(state.isPlaying ? "Pause {attempt}" : "Play {attempt}", { attempt: label })}>
          <svg aria-hidden="true" className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            {state.isPlaying
              ? <><rect x="4" y="3" width="4" height="14" rx="1" /><rect x="12" y="3" width="4" height="14" rx="1" /></>
              : <path d="M6 3.5a.75.75 0 0 1 1.15-.64l9 5.75a1.65 1.65 0 0 1 0 2.78l-9 5.75A.75.75 0 0 1 6 16.5z" />}
          </svg>
        </Button>
        <div className="min-w-0 flex-1">
          <input type="range" min={0} max={duration || 1} step={0.01} value={currentTime}
            disabled={disabled || duration <= 0}
            aria-label={t("Audio position · {attempt}", { attempt: label })}
            aria-valuetext={`${formatTime(currentTime)} / ${formatTime(duration)}`}
            onChange={(event) => { if (audioRef.current) audioRef.current.currentTime = Number(event.target.value); }}
            style={{ "--recording-progress": `${progress}%` } as CSSProperties}
            className={styles.seek} />
          <div aria-hidden="true" className="flex justify-between text-[11px] tabular-nums text-ink-muted">
            <span>{formatTime(currentTime)}</span><span>{duration > 0 ? formatTime(duration) : "—:—"}</span>
          </div>
        </div>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-danger">{t("Could not play this recording. Try again.")}</p>}
    </div>
  );
}
