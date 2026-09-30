import type { TaskItem } from "@/features/plan/schema";

export type NextPractice = "resume" | "complete" | "revisit" | "review" | "use" | "plan" | "tutor" | "lesson";

/** One presentation policy for Today. This does not change learning evidence or SRS. */
export function nextPractice(input: {
  active: boolean;
  completedToday: boolean;
  tutorDue: boolean;
  hasAi: boolean;
  cards: number;
  reviewRemaining: number;
  reviewedToday: number;
  planTask?: TaskItem;
}): NextPractice {
  if (input.active) return "resume";
  if (input.completedToday) return "complete";
  if (input.tutorDue && input.hasAi) return "revisit";
  if (input.reviewRemaining > 0) return "review";
  if (input.reviewedToday > 0 && input.cards > 0) return "use";
  if (input.planTask) return "plan";
  return input.hasAi ? "tutor" : "lesson";
}
