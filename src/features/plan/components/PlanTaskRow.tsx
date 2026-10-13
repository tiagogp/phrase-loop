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
      className={`flex items-start gap-2 rounded-xl border p-3 sm:gap-3 transition-colors ${
        done ? "border-line bg-surface" : highlight ? "border-accent/50 bg-accent/5" : "border-line bg-canvas"
      }`}
    >
      <button
        type="button"
        aria-label={done ? t(completeButtonLabel.done) : t(completeButtonLabel.pending)}
        onClick={onComplete}
        disabled={!done}
        title={!done ? t("Complete this task by doing the linked activity") : undefined}
        className={`flex min-h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          done
            ? "border-emerald-500 bg-emerald-500 text-white"
            : "border-line hover:border-accent"
        }`}
      >
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
      </button>

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 py-1">
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
        <p className={`w-full break-words text-sm leading-relaxed ${done ? "line-through text-ink-muted" : "text-ink"}`}>
          {task.instruction}
        </p>
      </div>

      {!done && !hideGoAction && onGo && (
        <button
          type="button"
          onClick={onGo}
          aria-label={`${t("Go")}: ${task.instruction}`}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg px-2 text-sm font-semibold text-accent transition-colors hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t("Go")} &rarr;
        </button>
      )}
    </li>
  );
}
