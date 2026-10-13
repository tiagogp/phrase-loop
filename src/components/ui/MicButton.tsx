"use client";

import { cn } from "@/lib/cn";
import { useT } from "@/i18n/I18nProvider";
import { Spinner } from "./Spinner";

export interface MicButtonProps {
  recording: boolean;
  transcribing?: boolean;
  elapsedMs?: number;
  maxMs?: number;
  /** Live input level, 0..1. */
  level?: number;
  disabled?: boolean;
  onStart: () => void;
  onStop: () => void;
  /** What the learner is about to say, shown while idle. */
  idleHint?: string;
  /** Mic permission or transcription problem, shown next to the button. */
  error?: string | null;
  /** Smaller control for inline use next to other actions. */
  compact?: boolean;
  className?: string;
}

const METER_BARS = 14;

function clock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

/** Row of bars that fill with the live input level (0..1). Decorative; status text carries meaning. */
export function LevelMeter({ level, className }: { level: number; className?: string }) {
  const filled = Math.round(level * METER_BARS);
  return (
    <div aria-hidden className={cn("flex h-5 items-center gap-[3px]", className)}>
      {Array.from({ length: METER_BARS }, (_, i) => (
        <span key={i} className={cn("h-full w-1 rounded-full transition-colors duration-100", i < filled ? "bg-danger" : "bg-line-strong/50")} />
      ))}
    </div>
  );
}

/** Record control: idle → recording (live level + timer) → transcribing. */
export function MicButton({ recording, transcribing = false, elapsedMs = 0, maxMs, level = 0, disabled, onStart, onStop, idleHint, error, compact = false, className }: MicButtonProps) {
  const { t } = useT();
  const busy = transcribing && !recording;
  const title = recording ? t("Recording… tap to stop") : busy ? t("Transcribing…") : t("Tap to speak");

  return (
    <div className={cn("space-y-2 text-left", className)}>
      <div
        className={cn(
          "flex items-center border transition-colors motion-reduce:transition-none",
          compact ? "gap-3 rounded-lg p-2.5" : "gap-3 rounded-lg p-3",
          recording ? "border-danger/40 bg-danger/5" : "border-line bg-input",
        )}
      >
        <div className={cn("relative shrink-0", compact ? "h-11 w-11" : "h-12 w-12")}>
          <span
            aria-hidden
            className={cn("absolute inset-0 rounded-full bg-danger/25 transition-transform duration-100 motion-reduce:transition-none", !recording && "opacity-0")}
            style={{ transform: `scale(${1 + level * 0.55})` }}
          />
          <button
            type="button"
            onClick={recording ? onStop : onStart}
            disabled={disabled || busy}
            aria-pressed={recording}
            aria-label={recording ? t("Stop recording") : t("Start recording")}
            className={cn(
              "relative flex items-center justify-center rounded-full shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 enabled:cursor-pointer enabled:active:scale-95",
              compact ? "h-11 w-11" : "h-12 w-12",
              recording ? "bg-danger text-white" : "bg-accent text-accent-contrast enabled:hover:brightness-95",
            )}
          >
            {busy ? <Spinner className={compact ? "h-5 w-5" : "h-6 w-6"} /> : recording ? <span aria-hidden className="h-5 w-5 rounded-[4px] bg-current" /> : <MicIcon />}
          </button>
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <p role="status" className="text-sm font-semibold text-ink">{title}</p>
          {recording ? (
            <>
              <LevelMeter level={level} />
              <p className="text-xs tabular-nums text-ink-muted">{clock(elapsedMs)}{maxMs ? ` / ${clock(maxMs)}` : ""}</p>
            </>
          ) : (
            idleHint && !busy && <p className="text-xs text-ink-muted">{idleHint}</p>
          )}
        </div>
      </div>
      {error && <p role="alert" className="flex items-start gap-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
