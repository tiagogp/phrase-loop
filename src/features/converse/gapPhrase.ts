import { buildManualPhrase } from "@/features/discover/manualPhrase";
import type { ReviewedGap } from "./gapReview";

/**
 * A gap saved as a phrase: the neutral natural form with the learner's intent as its meaning.
 * Provenance stays explicit (`gap-` ids, the conversation as source) so a tutor situation opened
 * from it records where it came from; that first practice counts as assisted.
 */
export async function buildGapPhrase(gap: ReviewedGap, conversationId: string, now = Date.now()) {
  const { cards, candidate } = await buildManualPhrase(gap.natural.neutral, gap.intent, now);
  const id = candidate.id.replace("manual-", "gap-");
  return {
    candidate: { ...candidate, id, sourceId: `conversation-gap:${conversationId}`, note: gap.evidence },
    cards: cards.map((card) => ({
      ...card,
      id: card.id.replace("manual-", "gap-"),
      patternId: id,
      concept: gap.patternLabel,
      context: "Lacuna da sessão longa",
      source: { kind: "phrase" as const, id },
    })),
  };
}
