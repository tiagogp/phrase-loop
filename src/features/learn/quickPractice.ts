import { recordReview, type ReviewTelemetry } from "@/lib/store/repository";
import type { Card } from "@/lib/cards/schema";
import type { Grade, SrsRecord } from "@/lib/srs/fsrs";
import { SCAFFOLD } from "@/features/study/scaffold";
import { lessonProgressFromCardIds, phraseKey, type Lesson } from "./lessonDeck";

export function nextQuickPhraseIndex(lesson: Lesson, cardIds: Iterable<string>): number {
  const taught = lessonProgressFromCardIds(cardIds).taught.get(lesson.id);
  const index = lesson.phrases.findIndex((phrase, i) => !taught?.has(phraseKey(phrase, i)));
  return Math.max(0, index);
}

/** A just-seen example cannot establish independent recall, regardless of self-rating. */
export function recordQuickPractice(card: Card, srs: SrsRecord, grade: Grade, telemetry: ReviewTelemetry) {
  return recordReview(card, srs, grade, { ...telemetry, hintUsed: true, scaffoldLevel: SCAFFOLD.modality });
}
