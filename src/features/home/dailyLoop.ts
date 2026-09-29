import type { LearningEvidenceInput } from "@/features/progress/learningEvidence";
import { isOriginalAttempt } from "@/features/progress/learningEvidence";

/** A small review batch leaves room to actually use the language afterwards. */
export function reviewLimitFor(minutes = 10): number {
  return minutes <= 5 ? 3 : minutes >= 20 ? 10 : 6;
}

export function deriveDailyLoop(input: Pick<LearningEvidenceInput, "cards" | "reviews" | "production"> & {
  due: number;
  minutes?: number;
  now: number;
}) {
  const start = new Date(input.now);
  start.setHours(0, 0, 0, 0);
  const today = (at: number) => at >= start.getTime() && at <= input.now;
  const reviewed = new Set(input.reviews.filter((review) => today(review.reviewedAt)).map((review) => review.cardId)).size;
  const productions = input.production.filter((attempt) => today(attempt.createdAt) && isOriginalAttempt(attempt)).length;
  const limit = reviewLimitFor(input.minutes);
  const reviewDone = input.cards.length > 0 && (reviewed >= limit || input.due === 0);
  const useDone = productions > 0;
  const complete = reviewDone && useDone;
  const next = complete ? "complete" : input.cards.length === 0 ? "lesson" : !reviewDone ? "review" : "use";
  return { reviewed, productions, limit, reviewDone, useDone, complete, next,
    remaining: Math.min(Math.max(0, limit - reviewed), input.due) } as const;
}
