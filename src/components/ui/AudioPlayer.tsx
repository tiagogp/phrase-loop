"use client";

import { useRef } from "react";
import { useAudioState } from "@/features/speech/hooks/useAudioState";
import { useT } from "@/i18n/I18nProvider";
import { Notice } from "./Notice";

interface AudioPlayerProps {
  audioUrl: string;
  voiceLabel: string;
}

export default function AudioPlayer({ audioUrl, voiceLabel }: AudioPlayerProps) {
  const { t } = useT();
  const audioRef = useRef<HTMLAudioElement>(null);
  const { state, error, progressPct, formatTime, audioHandlers, togglePlay, stop, seekToPct } =
    useAudioState(audioRef);

  return (
    <div className="space-y-3 rounded-lg border border-line bg-surface p-4">
      <audio
        ref={audioRef}
        src={audioUrl}
        {...audioHandlers}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-ink-soft">{voiceLabel}</span>
        <span className="text-xs tabular-nums text-ink-muted">
          {formatTime(state.currentTime)} /{" "}
          {state.duration > 0 ? formatTime(state.duration) : "--:--"}
        </span>
      </div>

      {/* Progress bar */}
      <input type="range" min={0} max={100} step={0.1} value={progressPct}
        aria-label={t("Audio position")} aria-valuetext={`${formatTime(state.currentTime)} / ${formatTime(state.duration)}`}
        disabled={state.duration <= 0} onChange={event => seekToPct(Number(event.target.value) / 100)}
        className="min-h-6 w-full cursor-pointer disabled:cursor-not-allowed" />
      {error && <Notice tone="error">{t("Could not play this audio. Try again or generate it again.")}</Notice>}

      <div className="flex items-center gap-2">
        {/* Play / Pause */}
        <button
          onClick={togglePlay}
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded bg-accent text-accent-contrast transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-accent"
          aria-label={t(state.isPlaying ? "Pause" : "Play")}
        >
          {state.isPlaying ? (
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <rect x="4" y="3" width="4" height="14" rx="1" />
              <rect x="12" y="3" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6 4l10 6-10 6V4z" />
            </svg>
          )}
        </button>

        {/* Stop */}
        <button
          onClick={stop}
          className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded border border-line text-ink-muted transition-colors hover:border-line-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          aria-label={t("Stop")}
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <rect x="4" y="4" width="12" height="12" rx="1" />
          </svg>
        </button>

        {/* Download */}
        <a
          href={audioUrl}
          download="speech.wav"
          className="ml-auto flex min-h-11 items-center gap-1.5 rounded border border-line px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-line-strong hover:bg-card focus-visible:outline-2 focus-visible:outline-accent"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {t("Download WAV")}
        </a>
      </div>
    </div>
  );
}
