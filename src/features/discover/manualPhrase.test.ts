import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { buildManualPhrase } from "./manualPhrase";
import { savedDeckRows } from "@/features/speech/savedDeck";
import { clearAll } from "@/lib/store/db";
import { getCards, getSrs, recordReview, saveGeneratedDeck } from "@/lib/store/repository";

afterEach(() => clearAll());

describe("manual phrase to practice and Anki", () => {
  it("preserves orientation through storage and exports a pair as one bilingual note", async () => {
    const { cards, candidate } = await buildManualPhrase("I'd like to reschedule.", "Eu gostaria de remarcar.");
    expect(await saveGeneratedDeck(cards, [candidate])).toEqual({ added: 2 });
    const stored = await getCards();
    expect(stored.find((card) => card.direction === "production")?.front).toBe("Eu gostaria de remarcar.");
    expect(savedDeckRows(stored)).toEqual([{ en: "I'd like to reschedule.", pt: "Eu gostaria de remarcar." }]);
  });
  it("is idempotent and preserves scheduling on another import of the same phrase", async () => {
    const { cards, candidate } = await buildManualPhrase("I work here.", "Eu trabalho aqui.");
    await saveGeneratedDeck(cards, [candidate]);
    const srs = (await getSrs(cards[0].id))!;
    const { next } = await recordReview(cards[0], srs, 4);
    const again = await buildManualPhrase(" I work here. ", "Eu trabalho aqui.");
    expect(again.cards[0].id).toBe(cards[0].id);
    expect(await saveGeneratedDeck(again.cards, [again.candidate])).toEqual({ added: 0 });
    expect(await getSrs(cards[0].id)).toEqual(next);
  });
  it("rejects empty and oversized entries", async () => {
    await expect(buildManualPhrase(" ", "oi")).rejects.toThrow();
    await expect(buildManualPhrase("Hello", "x".repeat(501))).rejects.toThrow();
  });
});
