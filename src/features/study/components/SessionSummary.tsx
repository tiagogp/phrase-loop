"use client";

/**
 * A bounded session ends with activity and observed recall kept separate. The
 * self-selected scheduling grade never becomes an accuracy claim. Tomorrow's
 * preview describes the review schedule, not a prediction of proficiency.
 */

import { Card } from "@/components/ui/Card";
import { Rating, recallProbabilityAt, type Grade, type SrsRecord } from "@/lib/srs/fsrs";
import { useT } from "@/i18n/I18nProvider";
import type { ReviewRecord } from "@/lib/store/repository";
import { isIndependentReview } from "@/features/progress/learningEvidence";

export interface SessionResult {
  cardId: string;
  grade: Grade;
  /** SRS state *after* grading — what we predict tomorrow's recall from. */
  srs: SrsRecord;
  review?: ReviewRecord;
}

/** What's waiting by the local end of tomorrow — the calm reason to come back. */
export interface TomorrowPreview {
  due: number;
  /** How many of those cards were derived from the learner's own errors. */
  mistakeCards: number;
  /** True when at least one mistake card's source error was made today. */
  fromToday: boolean;
  /** Part of `due` that FSRS brings back within today's short learning steps. */
  laterToday?: number;
}

/**
 * One sentence closing the loop toward tomorrow. Honesty rules mirror the Hoje
 * return moment: the mistake claim only appears when a due card's provenance backs
 * it, and an empty tomorrow says so — no invented urgency.
 */
export function tomorrowLine(
  preview: TomorrowPreview,
  t: (en: string, vars?: Record<string, string | number>) => string,
): string {
  if (preview.due === 0) {
    return t("Nothing due tomorrow yet — the next review arrives right on time.");
  }
  if (preview.fromToday && preview.mistakeCards > 0) {
    if (preview.due === 1) {
      return t("Tomorrow: the phrase from today's mistake is waiting for you.");
    }
    return preview.mistakeCards === 1
      ? t("Tomorrow: {count} phrases are waiting — 1 came from today's mistake.", {
          count: preview.due,
        })
      : t("Tomorrow: {count} phrases are waiting — {mistakes} came from today's mistakes.", {
          count: preview.due,
          mistakes: preview.mistakeCards,
        });
  }
  return preview.due === 1
    ? t("Tomorrow: 1 phrase is waiting for you.")
    : t("Tomorrow: {count} phrases are waiting for you.", { count: preview.due });
}

/** A card counts as "stable for tomorrow" when predicted +24h recall clears this bar. */
const STABLE_THRESHOLD = 0.9;
const STABLE_HOURS = 24;

export function summarize(results: SessionResult[]): { reviewed: number; passed: number; stable: number } {
  const reviewed = results.length;
  const passed = results.filter((r) => r.grade >= Rating.Good).length;
  const stable = results.filter(
    (r) => recallProbabilityAt(r.srs, STABLE_HOURS) >= STABLE_THRESHOLD,
  ).length;
  return { reviewed, passed, stable };
}

export function SessionSummary({
  results,
  tomorrow,
}: {
  results: SessionResult[];
  tomorrow?: TomorrowPreview | null;
}) {
  const { t } = useT();
  const { reviewed } = summarize(results);
  const observed = results.flatMap((result) => result.review && isIndependentReview(result.review) ? [result.review] : []);
  const correct = observed.filter((review) => review.responseCorrect === true).length;

  return (
    <Card className="space-y-5 p-6 text-center sm:p-8">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-ink">{t("Practice saved")}</p>
        <p className="text-xs text-ink-muted">
          {t("{count} reviews in this session.", { count: reviewed })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-2xl font-semibold tabular-nums text-ink">{reviewed}</p>
          <p className="mt-0.5 text-xs text-ink-muted">{t("phrases reviewed")}</p>
        </div>
        <div>
          <p className="text-2xl font-semibold tabular-nums text-ink">{observed.length ? `${correct}/${observed.length}` : "—"}</p>
          <p className="mt-0.5 text-xs text-ink-muted">{t("checked without hints")}</p>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-ink-muted">{t("This is today's practice. Remembering it on another day is the next step.")}</p>

      {tomorrow && (
        <>
          <p className="text-xs text-ink-soft">{tomorrowLine(tomorrow, t)}</p>
          {/* Saying "tomorrow" while the first repetitions return in minutes would set the
              wrong expectation for the rest of today. */}
          {(tomorrow.laterToday ?? 0) > 0 && (
            <p className="text-xs text-ink-muted">
              {tomorrow.laterToday === 1
                ? t("1 of them comes back later today — the first repetition is spaced in minutes.")
                : t("{count} of them come back later today — the first repetitions are spaced in minutes.", {
                    count: tomorrow.laterToday ?? 0,
                  })}
            </p>
          )}
        </>
      )}
    </Card>
  );
}
