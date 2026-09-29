import type { Card } from "@/lib/cards/schema";
import { meaningTextOfCard, targetTextOfCard } from "@/lib/cards/orientation";

/** Recognition/production pairs become one bilingual note in the Kokoro export. */
export function savedDeckRows(cards: Card[]): { pt: string; en: string }[] {
  const rows = new Map<string, { pt: string; en: string }>();
  for (const card of cards) {
    const en = targetTextOfCard(card).trim();
    const pt = meaningTextOfCard(card).trim();
    if (!en || !pt) continue;
    const key = `${en.toLowerCase()}\n${pt.toLowerCase()}`;
    if (!rows.has(key)) rows.set(key, { pt, en });
  }
  return [...rows.values()];
}
