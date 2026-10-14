import "fake-indexeddb/auto";
import { afterEach, expect, it } from "vitest";
import type { Card } from "@/lib/cards/schema";
import { savedDeckRows } from "@/features/speech/savedDeck";
import { clearAll, get, put, STORES } from "./db";
import { ensureProductiveCardPairs, getCard, getCards, getSrs, recordReview, saveCorrectionDeck } from "./repository";

afterEach(() => clearAll());

it("repairs existing correction cards for library, individual reads and Anki without resetting reviews", async () => {
  const card: Card = { id: "travel", front: "I need to travel next month", back: "preciso viajar no próximo mês",
    concept: "travel plans", source: { kind: "error", id: "error-1" }, createdAt: 1 };
  await saveCorrectionDeck([card]);
  const production = (await getCard("travel--production"))!;
  const { next } = await recordReview(production, (await getSrs(production.id))!, 4);
  const legacy = { ...production, front: 'Corrija esta frase em inglês sem ver o modelo: “I need travel in one month”' };
  await put(STORES.cards, legacy);

  expect((await getCard(production.id))?.front).toBe(card.back);
  expect((await getCards()).find(c => c.id === production.id)?.front).toBe(card.back);
  expect(savedDeckRows([legacy, { ...card, direction: "recognition" }])).toEqual([{ en: card.front, pt: card.back }]);
  expect(savedDeckRows([legacy])).toEqual([]); // An orphaned instruction is not a translation.
  expect(savedDeckRows(await getCards())).toEqual([{ en: card.front, pt: card.back }]);
  expect(await ensureProductiveCardPairs()).toEqual({ added: 0 });
  expect(await get<Card>(STORES.cards, production.id)).toEqual(production);
  expect(await getSrs(production.id)).toEqual(next);
  expect(await ensureProductiveCardPairs()).toEqual({ added: 0 });
});
