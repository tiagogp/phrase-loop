import { TASK_COLORS, TASK_LABELS } from "../constants";
import type { PlanTaskRowProps } from "../types";
import { useT } from "@/i18n/I18nProvider";

export function PlanTaskRow({
  task,
  onGo,
  onComplete,
  hideGoAction = false,
  highlight = false,
  completeButtonLabel = {
    done: "Mark as not done",
    pending: "Mark as done",
  },
}: PlanTaskRowProps) {
  const { t } = useT();
  const done = task.completedAt != null;

  return (
    <li
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
        done ? "border-line bg-surface" : highlight ? "border-accent/50 bg-accent/5" : "border-line bg-canvas"
      }`}
    >
      <button
        type="button"
        aria-label={done ? t(completeButtonLabel.done) : t(completeButtonLabel.pending)}
        onClick={onComplete}
        disabled={!done}
        title={!done ? t("Complete this task by doing the linked activity") : undefined}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md enabled:hover:bg-accent/10 pointer-coarse:h-11 pointer-coarse:w-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          done
            ? "text-white"
            : "text-ink-muted"
        }`}
      >
        <span aria-hidden className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${done ? "border-emerald-500 bg-emerald-500" : "border-line-strong"}`}>
          {done && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
              <path
                d="M1 4l3 3 5-6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
      </button>

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
        {highlight && !done && (
          <span className="shrink-0 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-contrast">
            {t("Next")}
          </span>
        )}
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            TASK_COLORS[task.type]
          }`}
        >
          {t(TASK_LABELS[task.type])}
        </span>
        <p className={`w-full break-words text-sm leading-snug sm:w-auto sm:min-w-0 sm:flex-1 ${done ? "line-through text-ink-muted" : "text-ink"}`}>
          {task.instruction}
        </p>
      </div>

      {!done && !hideGoAction && onGo && (
        <button
          type="button"
          onClick={onGo}
          aria-label={`${t("Go")}: ${task.instruction}`}
          className="flex min-h-8 min-w-8 pointer-coarse:min-h-11 pointer-coarse:min-w-11 shrink-0 items-center justify-center rounded-lg px-2 text-sm font-semibold text-accent transition-colors hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t("Go")} &rarr;
        </button>
      )}
    </li>
  );
}
