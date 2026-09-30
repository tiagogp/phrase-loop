import type { Card } from "@/lib/cards/schema";
import type { ReviewRecord } from "@/lib/store/repository";
import type { TutorPreferences, TutorSession } from "@/features/tutor/types";
import { allowedTutorAttempt } from "@/features/tutor/learning";

export type ExperienceStage = "new" | "first_action" | "first_result" | "first_loop" | "familiar" | "power";
export type DiscoveryId = "review" | "content" | "conversation";

/** Product familiarity only. Never used to grade, schedule, or restrict access. */
export function deriveExperience({ sessions, preferences, cards, reviews }: {
  sessions: TutorSession[];
  preferences: TutorPreferences;
  cards: Card[];
  reviews: ReviewRecord[];
}) {
  const eligible = sessions.map(session => ({
    session,
    attempts: session.attempts.filter(attempt => allowedTutorAttempt(attempt, preferences) && attempt.feedback.status !== "uncertain"),
  }));
  const tutorLoops = eligible.filter(({ session, attempts }) => session.phase === "complete" && session.completedAt
    && (attempts.length >= 2 || attempts.some(attempt => attempt.feedback.status === "met")));
  // A persisted review is evidence of a saved-and-reviewed phrase, including
  // legacy cards that were subsequently removed. It is NOT proof of mastery.
  const loopTimes = [...tutorLoops.map(({ session }) => session.completedAt!), ...reviews.map(review => review.reviewedAt)];
  const firstLoopAt = loopTimes.length ? Math.min(...loopTimes) : null;
  const activityTimes = [...eligible.flatMap(({ attempts }) => attempts.map(attempt => attempt.createdAt)), ...reviews.map(review => review.reviewedAt)];
  const returned = firstLoopAt !== null && activityTimes.some(at => at - firstLoopAt >= 86_400_000);
  const practicedOwnContent = sessions.some(session => session.sourceCardId && session.attempts.length > 0);
  const active = sessions.filter(session => session.phase !== "complete").sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const hasResult = eligible.some(({ attempts }) => attempts.length > 0) || reviews.length > 0;
  const stage: ExperienceStage = returned ? practicedOwnContent ? "power" : "familiar"
    : firstLoopAt !== null ? "first_loop" : hasResult ? "first_result"
      : sessions.some(session => session.phase !== "complete" || session.attempts.length > 0) || cards.length > 0 ? "first_action" : "new";
  return {
    stage,
    firstLoopAt,
    hasResult,
    familiar: returned,
    firstLoopComplete: firstLoopAt !== null,
    active,
    cards: cards.length,
    reviews: reviews.length,
    practicedOwnContent,
    discovery: (cards.length > 0 && reviews.length === 0 ? "review"
      : firstLoopAt !== null && !practicedOwnContent ? "content"
        : returned && practicedOwnContent ? "conversation" : null) as DiscoveryId | null,
  };
}
