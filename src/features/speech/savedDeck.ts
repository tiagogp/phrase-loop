import type { Card } from "@/lib/cards/schema";
import { meaningTextOfCard, targetTextOfCard } from "@/lib/cards/orientation";
import { isLegacyCorrectionCard, repairCorrectionCardPairs } from "@/lib/cards/pairs";

/** Recognition/production pairs become one bilingual note in the Kokoro export. */
export function savedDeckRows(cards: Card[]): { pt: string; en: string }[] {
  const rows = new Map<string, { pt: string; en: string }>();
  for (const card of repairCorrectionCardPairs(cards)) {
    // Without its sibling there is no translation to recover. Never export the
    // correction instruction as if it were Portuguese phrase content.
    if (isLegacyCorrectionCard(card)) continue;
    const en = targetTextOfCard(card).trim();
    const pt = meaningTextOfCard(card).trim();
    if (!en || !pt) continue;
    const key = `${en.toLowerCase()}\n${pt.toLowerCase()}`;
    if (!rows.has(key)) rows.set(key, { pt, en });
  }
  return [...rows.values()];
}
