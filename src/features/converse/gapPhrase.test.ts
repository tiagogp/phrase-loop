import { describe, expect, it } from "vitest";
import { buildGapPhrase } from "./gapPhrase";

describe("buildGapPhrase", () => {
  it("saves the neutral form with the learner's intent and keeps the conversation as provenance", async () => {
    const { candidate, cards } = await buildGapPhrase({
      kind: "code_switch", evidence: "a gente precisa adiar", intent: "adiar a entrega", why: "",
      natural: { casual: "Let's push it back", neutral: "We need to postpone the release" }, patternLabel: "postpone-delivery", severity: "high",
    }, "conv-1", 1000);
    expect(candidate).toMatchObject({ text: "We need to postpone the release", translation: "adiar a entrega", sourceId: "conversation-gap:conv-1", note: "a gente precisa adiar" });
    expect(candidate.id.startsWith("gap-")).toBe(true);
    expect(cards.map((card) => card.direction)).toEqual(["recognition", "production"]);
    for (const card of cards) expect(card).toMatchObject({ patternId: candidate.id, concept: "postpone-delivery", source: { kind: "phrase", id: candidate.id } });
  });
});
