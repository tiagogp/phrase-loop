import "fake-indexeddb/auto";
import { afterEach, expect, it } from "vitest";
import { clearAll } from "@/lib/store/db";
import { getCards, getReviews, getSrs, saveGeneratedDeck } from "@/lib/store/repository";
import { Rating } from "@/lib/srs/fsrs";
import { isIndependentReview } from "@/features/progress/learningEvidence";
import { buildDeckFromPhrases, firstLesson } from "./lessonDeck";
import { nextQuickPhraseIndex, recordQuickPractice } from "./quickPractice";

afterEach(() => clearAll());

it("introduces an unsaved phrase when returning to a partially learned lesson", () => {
  const lesson = firstLesson();
  const deck = buildDeckFromPhrases(`lesson-${lesson.id}`, lesson.phrases, [0]);
  expect(nextQuickPhraseIndex(lesson, [])).toBe(0);
  expect(nextQuickPhraseIndex(lesson, deck.cards.map(card => card.id))).toBe(1);
});

it("keeps both phrase directions, schedules the attempt, and never calls immediate practice independent", async () => {
  const lesson = firstLesson();
  const deck = buildDeckFromPhrases(`lesson-${lesson.id}`, lesson.phrases, [0]);
  await saveGeneratedDeck(deck.cards, deck.candidates);
  const card = deck.cards[0];
  const srs = (await getSrs(card.id))!;
  const { next, review } = await recordQuickPractice(card, srs, Rating.Good, {
    responseText: card.back, responseCorrect: true, hintUsed: false, scaffoldLevel: 0,
  });
  expect(await getCards()).toHaveLength(2);
  expect(await getReviews()).toHaveLength(1);
  expect(isIndependentReview(review)).toBe(false);
  expect((await getSrs(card.id))?.due).toBe(next.due);
  expect(next.due).toBeGreaterThanOrEqual(review.reviewedAt);
  // Revisiting the lesson cannot reset its existing review schedule.
  await saveGeneratedDeck(deck.cards, deck.candidates);
  expect((await getSrs(card.id))?.due).toBe(next.due);
  expect(await getReviews()).toHaveLength(1);
});
