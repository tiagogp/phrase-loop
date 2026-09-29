import type { Card, PhraseCandidate } from "@/lib/cards/schema";

export async function buildManualPhrase(english: string, meaning: string, now = Date.now()) {
  const en = english.trim();
  const pt = meaning.trim();
  if (!en || !pt || en.length > 500 || pt.length > 500) throw new Error("Enter a phrase and its meaning, up to 500 characters each.");
  const normalized = `${en.toLocaleLowerCase("en")}\n${pt.toLocaleLowerCase("pt")}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  const id = `manual-${Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 24)}`;
  const candidate: PhraseCandidate = { id, sourceId: "manual", text: en, translation: pt, status: "accepted", createdAt: now };
  const common = { concept: "Your own phrase", patternId: id, source: { kind: "phrase" as const, id }, createdAt: now };
  const cards: Card[] = [
    { ...common, id, front: en, back: pt, direction: "recognition" },
    { ...common, id: `${id}--production`, front: pt, back: en, direction: "production" },
  ];
  return { cards, candidate };
}
