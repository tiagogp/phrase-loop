import type { ProductionAttempt } from "@/lib/performance/types";
import type { Card } from "@/lib/cards/schema";
import type { Grade, SrsRecord } from "@/lib/srs/fsrs";
import { recordReview, saveProductionAttempt } from "@/lib/store/repository";
import type { Lesson } from "./lessonDeck";

export type LocalSelfAssessment = "needs_practice" | "partly" | "communicated";
export function localProduction(lesson: Lesson, text: string, startedAt: number, submittedAt: number, id: string): ProductionAttempt {
  return { id, lessonId: lesson.id, source: "lesson", stage: "production", prompt: lesson.productionPrompt,
    text: text.trim(), spoken: false, wordCount: text.trim().split(/\s+/).filter(Boolean).length,
    finished: false, issueCount: 0, evaluated: false, scaffoldUsed: false,
    preparationMs: Math.max(0, submittedAt - startedAt), createdAt: submittedAt };
}

/** A self-rating is process data only. Future card reviews keep their existing date. */
export async function finishLocalProduction(attempt: ProductionAttempt, assessment: LocalSelfAssessment, card: Card, srs: SrsRecord, grade: Grade, now = Date.now()) {
  await saveProductionAttempt({ ...attempt, evaluated: false, judge: undefined, selfAssessment: assessment, finished: true, completedAt: now });
  if (srs.due > now) return srs;
  const { next } = await recordReview(card, srs, grade, { responseText: attempt.text, hintUsed: true, scaffoldLevel: 2 }, new Date(now));
  return next;
}
