import { buildManualPhrase } from "@/features/discover/manualPhrase";
import type { TutorSession } from "./types";

export async function buildTutorPhrase(session: TutorSession) {
  const attempt = session.attempts.at(-1);
  if (!attempt || attempt.disputed || attempt.feedback.status === "uncertain") throw new Error("Escolha primeiro um exemplo com avaliação válida.");
  const { cards, candidate } = await buildManualPhrase(attempt.feedback.example.english, attempt.feedback.example.meaning);
  // Preserve deduplication by text while keeping AI-generated provenance explicit.
  const id = candidate.id.replace("manual-", "tutor-");
  return {
    candidate: { ...candidate, id, sourceId: `tutor:${session.id}` },
    cards: cards.map(card => ({ ...card, id: card.id.replace("manual-", "tutor-"), patternId: id,
      concept: session.task.goal, context: "Exemplo gerado pelo tutor", source: { kind: "phrase" as const, id } })),
  };
}
