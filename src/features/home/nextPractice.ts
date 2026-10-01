import { chooseTutorScenario, TUTOR_CONCEPTS } from "@/features/tutor/catalog";
import { tutorSkillEvidence } from "@/features/tutor/learning";
import type { TutorSession } from "@/features/tutor/types";
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

/** Reserve at launch, including unfinished extras, so restarting cannot evade the cap.
 * Only a different skill with no known exposure in 24h is eligible. No parent reminder is consumed. */
export function extraPractice(sessions: TutorSession[], now: number) {
  const today = new Date(now).toDateString();
  const used = sessions.filter(s => s.extraPractice && s.createdAt <= now && new Date(s.createdAt).toDateString() === today).length;
  if (used >= 2) return undefined;
  const eligible = Object.keys(TUTOR_CONCEPTS).filter(id => {
    const related = sessions.filter(s => s.skill?.conceptId === id);
    if (related.some(s => s.phase !== "complete")) return false;
    const skill = related[0]?.skill;
    const evidence = skill ? tutorSkillEvidence(sessions, skill) : undefined;
    const last = Math.max(evidence?.lastPracticedAt ?? 0, evidence?.lastSupportAt ?? 0);
    return !last || now - last >= 86_400_000;
  }).sort((a, b) => sessions.filter(s => s.skill?.conceptId === a).length - sessions.filter(s => s.skill?.conceptId === b).length);
  const conceptId = eligible[0];
  const task = conceptId && chooseTutorScenario(conceptId, sessions);
  return task ? { task, conceptId, remaining: 2 - used } : undefined;
}
