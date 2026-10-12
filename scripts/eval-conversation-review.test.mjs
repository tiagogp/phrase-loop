import { expect, it } from "vitest";
import { compareReviews, longSessionsFrom, parseSide, renderComparison } from "./eval-conversation-review.mjs";
import { buildGapReviewPrompt, parseGapReview } from "../src/features/converse/gapReview";

const session = {
  id: "conv-1", mode: "long", level: "B1", scenario: "Say no to the PM", context: "say-no", startedAt: Date.UTC(2026, 9, 12),
  longSession: { label: "Say no to the PM" },
  turns: [
    { role: "assistant", text: "Can we add the export button this sprint?" },
    { role: "user", text: "eu acho que não cabe", codeSwitch: true },
  ],
};

it("reads long sessions from a backup and ignores ordinary conversations", () => {
  const backup = { stores: { conversations: [session, { ...session, id: "plain", mode: undefined }, { ...session, id: "silent", turns: [session.turns[0]] }] } };
  expect(longSessionsFrom(backup).map(c => c.id)).toEqual(["conv-1"]);
  expect(longSessionsFrom([session])).toHaveLength(1);
});

it("parses provider sides, keeping a model only for Ollama", () => {
  expect(parseSide("ollama:gemma4:27b")).toEqual({ provider: "ollama", model: "gemma4:27b", label: "ollama:gemma4:27b" });
  expect(parseSide("claude:anything")).toEqual({ provider: "claude", model: undefined, label: "claude" });
  expect(() => parseSide("gemini")).toThrow(/Unknown provider/);
});

it("runs the app's own prompt and parser per model and reports them side by side", async () => {
  const prompts = [];
  const replies = {
    "ollama:small": "not json at all",
    claude: JSON.stringify({ strengths: ["Respondeu rápido."], gaps: [{ kind: "code_switch", evidence: "eu acho que não cabe", intent: "dizer que não cabe",
      natural: { casual: "I don't think it fits", neutral: "I don't think we can fit that in this sprint" }, patternLabel: "say-no-scope", severity: "high" }] }),
  };
  const sides = [parseSide("ollama:small"), parseSide("claude")];
  const rows = await compareReviews([session], { runtime: { buildGapReviewPrompt, parseGapReview }, sides,
    completeFor: side => async prompt => { prompts.push(prompt); return replies[side.label]; } });

  expect(prompts[0]).toContain("Learner (stuck, said in Portuguese): eu acho que não cabe");
  expect(rows[0].results["ollama:small"].malformed).toBe(true);
  expect(rows[0].results.claude.gaps[0]).toMatchObject({ patternLabel: "say-no-scope", natural: "I don't think we can fit that in this sprint" });
  const markdown = renderComparison({ sides: sides.map(s => s.label), generatedAt: "now", promptVersion: "v", sessions: rows });
  expect(markdown).toContain("| Lacuna 1 | ⚠ resposta malformada | **say-no-scope** (code_switch)");
  expect(markdown).toContain("Nenhum modelo é declarado calibrado");
});
