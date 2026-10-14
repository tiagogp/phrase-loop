import { describe, expect, it } from "vitest";
import type { Card, PhraseCandidate } from "./schema";
import { buildProductiveCardPairs, repairCorrectionCardPairs } from "./pairs";

const candidate: PhraseCandidate = {
  id: "phrase-1",
  sourceId: "source-1",
  text: "I ran out of time.",
  translation: "Eu fiquei sem tempo.",
  status: "accepted",
  createdAt: 1,
};

const card: Card = {
  id: "card-1",
  front: "I ran out of time.",
  back: "Eu fiquei sem tempo.",
  concept: "run out of",
  source: { kind: "phrase", id: candidate.id },
  createdAt: 1,
};

describe("buildProductiveCardPairs", () => {
  it("reverses a corrected English phrase and its translation without adding correction instructions", () => {
    const correction: Card = { ...card, source: { kind: "error", id: "error-1" }, front: "I need to travel next month", back: "preciso viajar no próximo mês" };
    const result = buildProductiveCardPairs([correction], [{ kind: "error", event: {
      id: "error-1", original: "I need travel in one month", corrected: correction.front,
      sourceLang: "pt", targetLang: "en", errorTypes: ["preposition"], createdAt: 1,
    } }]);
    expect(result.map(({ front, back }) => ({ front, back }))).toEqual([
      { front: correction.front, back: correction.back }, { front: correction.back, back: correction.front },
    ]);
    // The storage path may receive only cards, without their source events.
    expect(buildProductiveCardPairs([correction])).toEqual(result);
  });

  it("repairs each saved correction sibling using its exact English phrase, not just a shared error ID", () => {
    const recognition: Card = { ...card, source: { kind: "error", id: "error-1" }, direction: "recognition" };
    const other = { ...recognition, id: "other", front: "I need to travel next month", back: "preciso viajar no próximo mês" };
    const legacy: Card = { ...other, id: "other--production", direction: "production", back: other.front,
      front: 'Corrija esta frase em inglês sem ver o modelo: “I need travel in one month”' };
    const authored: Card = { ...legacy, id: "authored", front: "Describe your travel plans." };
    const result = repairCorrectionCardPairs([recognition, other, legacy, authored]);
    expect(result[2]).toEqual({ ...legacy, front: other.back });
    expect(result[3]).toEqual(authored);
    expect(repairCorrectionCardPairs(result)).toEqual(result);
    expect(repairCorrectionCardPairs([legacy])).toEqual([legacy]);
  });
  it("adds an explicit production sibling without exposing the answer", () => {
    const result = buildProductiveCardPairs([card], [{ kind: "phrase", candidate }]);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ direction: "recognition", front: card.front });
    expect(result[1]).toMatchObject({
      direction: "production",
      front: candidate.translation,
      back: candidate.text,
      patternId: result[0].patternId,
    });
  });

  it("does not duplicate cards whose direction is already authored", () => {
    const result = buildProductiveCardPairs([{ ...card, direction: "production" }]);
    expect(result).toHaveLength(1);
    expect(result[0].direction).toBe("production");
  });

  it("uses a cloze when an imported phrase has no learner-language meaning", () => {
    const withoutTranslation = { ...candidate, translation: undefined };
    const production = buildProductiveCardPairs(
      [{ ...card, back: "Explain the meaning." }],
      [{ kind: "phrase", candidate: withoutTranslation }],
    )[1];
    expect(production.front).toContain("____");
    expect(production.front).not.toContain(candidate.text);
    expect(production.back).toBe(candidate.text);
  });
});
