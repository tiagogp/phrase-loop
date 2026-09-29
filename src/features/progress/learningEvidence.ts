import type { Card } from "@/lib/cards/schema";
import type { ListeningAttempt, ProductionAttempt, ProofAttempt, RetryOutcome } from "@/lib/performance/types";
import type { ReviewRecord } from "@/lib/store/repository";
import { instrumentKey } from "@/lib/evaluation/judge";

const DAY = 86_400_000;

export interface LearningEvidenceInput {
  cards: Card[];
  reviews: ReviewRecord[];
  production: ProductionAttempt[];
  retries: RetryOutcome[];
  listening: ListeningAttempt[];
  proofs: ProofAttempt[];
}

export interface LearningWin {
  id: string;
  kind: "recall" | "retry" | "transfer";
  text: string;
  before?: string;
  at: number;
  days?: number;
  supported?: boolean;
}

export interface EvidenceRate {
  correct: number;
  total: number;
  percent: number | null;
}

function rate(values: boolean[]): EvidenceRate {
  const correct = values.filter(Boolean).length;
  return { correct, total: values.length, percent: values.length ? Math.round(correct / values.length * 100) : null };
}

export function isIndependentReview(review: ReviewRecord): boolean {
  return review.direction === "production" && review.hintUsed !== true &&
    (review.scaffoldLevel ?? 0) === 0 && Boolean(review.responseText?.trim()) &&
    typeof review.responseCorrect === "boolean";
}

export function isOriginalAttempt(attempt: ProductionAttempt): boolean {
  return attempt.finished && !attempt.skipped && attempt.stage !== "repeat" &&
    attempt.stage !== "retry" && !attempt.retryOf && !attempt.listeningRecognition &&
    attempt.transferKind !== "listening_recognition" && attempt.transferKind !== "reading_to_meaning" && Boolean(attempt.text.trim());
}

/** Examples are observations, never a proficiency score or a claim of permanent mastery. */
export function deriveLearningEvidence(input: LearningEvidenceInput, now = Date.now()) {
  const recent = (at: number) => at >= now - 30 * DAY && at <= now;
  const cards = new Set(input.cards.map((card) => card.id));
  const reviews = input.reviews.filter((review) => review.reviewedAt <= now)
    .sort((a, b) => a.reviewedAt - b.reviewedAt);
  const latest = new Map<string, ReviewRecord>();
  const previous = new Map<string, ReviewRecord>();
  for (const review of reviews) {
    const prior = latest.get(review.cardId);
    if (prior) previous.set(review.cardId, prior);
    latest.set(review.cardId, review);
  }
  const wins: LearningWin[] = [];
  for (const review of latest.values()) {
    if (!cards.has(review.cardId) || !recent(review.reviewedAt) ||
      !isIndependentReview(review) || review.responseCorrect !== true) continue;
    const prior = previous.get(review.cardId);
    const days = prior ? Math.floor((review.reviewedAt - prior.reviewedAt) / DAY) : 0;
    wins.push({ id: review.id, kind: "recall", text: review.responseText!.trim(), at: review.reviewedAt, days });
  }

  const originals = new Map(input.production.map((attempt) => [attempt.id, attempt]));
  const latestRetries = new Map<string, RetryOutcome>();
  for (const retry of input.retries.filter((item) => item.createdAt <= now).sort((a, b) => a.createdAt - b.createdAt)) {
    latestRetries.set(retry.retryOf, retry);
  }
  for (const retry of latestRetries.values()) {
    const original = originals.get(retry.retryOf);
    if (!original || original.issueCount < 1 || !recent(retry.createdAt) || !retry.resolved ||
      retry.resolution === "dismissed" || retry.resolution === "deferred" || retry.skipped ||
      retry.issueCount >= original.issueCount || retry.createdAt < original.createdAt ||
      !retry.text.trim() || retry.text.trim() === original.text.trim()) continue;
    wins.push({ id: retry.id, kind: "retry", before: original.text, text: retry.text,
      at: retry.createdAt, supported: retry.scaffoldUsed });
  }
  // Study retries are production records, linked to the first answer on the same prompt.
  const studyRetries = new Map<string, ProductionAttempt>();
  for (const attempt of input.production.filter((item) => item.retryOf && item.createdAt <= now).sort((a, b) => a.createdAt - b.createdAt)) {
    studyRetries.set(attempt.retryOf!, attempt);
  }
  for (const retry of studyRetries.values()) {
    const original = originals.get(retry.retryOf!);
    if (!original || original.evaluated !== true || retry.evaluated !== true || !retry.finished || retry.skipped ||
      !original.judge || !retry.judge || instrumentKey(original.judge) !== instrumentKey(retry.judge) ||
      original.issueCount < 1 || retry.issueCount >= original.issueCount || retry.taskCompleted !== true ||
      !recent(retry.createdAt) || retry.createdAt < original.createdAt || !retry.text.trim() ||
      retry.text.trim() === original.text.trim()) continue;
    wins.push({ id: retry.id, kind: "retry", before: original.text, text: retry.text, at: retry.createdAt, supported: true });
  }
  const production = input.production.filter((attempt) => recent(attempt.createdAt) && isOriginalAttempt(attempt));
  const transfer = production.filter((attempt) => attempt.evaluated === true && attempt.transferVerified === true && !attempt.scaffoldUsed);
  for (const attempt of transfer) {
    if (attempt.newContext !== true || attempt.taskCompleted !== true || attempt.issueCount > 0) continue;
    wins.push({ id: attempt.id, kind: "transfer", text: attempt.text, at: attempt.createdAt });
  }

  const measured = reviews.filter((review) => recent(review.reviewedAt) && isIndependentReview(review));
  const currentWeek = measured.filter((review) => review.reviewedAt >= now - 7 * DAY);
  const previousWeek = measured.filter((review) => review.reviewedAt < now - 7 * DAY && review.reviewedAt >= now - 14 * DAY);
  // Compare one latest observation per card and instrument in each week. Repeating an
  // easy item many times must not manufacture an improvement in the comparison.
  const comparisonKey = (review: ReviewRecord) => `${review.cardId}:${instrumentKey(review.judge)}`;
  const latestPerItem = (items: ReviewRecord[]) => new Map(items.filter((review) => review.judge).map((review) => [comparisonKey(review), review]));
  const oldItems = latestPerItem(previousWeek);
  const newItems = latestPerItem(currentWeek);
  const sharedKeys = [...newItems.keys()].filter((key) => oldItems.has(key));
  const comparableCurrent = sharedKeys.map((key) => newItems.get(key)!);
  const comparablePrevious = sharedKeys.map((key) => oldItems.get(key)!);
  const common = new Set(comparableCurrent.map((review) => review.cardId));
  const currentRate = rate(comparableCurrent.map((review) => review.responseCorrect === true));
  const previousRate = rate(comparablePrevious.map((review) => review.responseCorrect === true));
  const proofs = input.proofs.filter((proof) => recent(proof.answeredAt) && typeof proof.correct === "boolean");

  const uniqueWins = new Map<string, LearningWin>();
  for (const win of wins.sort((a, b) => b.at - a.at)) {
    const key = `${win.kind}:${win.text.trim().toLowerCase()}`;
    if (!uniqueWins.has(key)) uniqueWins.set(key, win);
  }
  return {
    wins: [...uniqueWins.values()],
    recall: rate(measured.map((review) => review.responseCorrect === true)),
    retention: rate(proofs.map((proof) => proof.correct === true)),
    transfer: rate(transfer.map((attempt) => attempt.newContext === true && attempt.taskCompleted === true && attempt.issueCount === 0)),
    comparison: { current: currentRate, previous: previousRate, cards: common.size,
      delta: common.size >= 5
        ? currentRate.percent! - previousRate.percent! : null },
  };
}

export type LearningEvidence = ReturnType<typeof deriveLearningEvidence>;
