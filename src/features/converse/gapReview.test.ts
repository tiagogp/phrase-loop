import { describe, expect, it } from "vitest";
import type { ConversationTurn } from "@/lib/cards/provider";
import { buildGapReviewPrompt, gapExplanationLanguage, normalizePatternLabel, parseGapReview, rankGaps, type ReviewedGap } from "./gapReview";

const turns: ConversationTurn[] = [
  { role: "assistant", text: "So when do you think the migration will be done?" },
  { role: "user", text: "It is difficult. We have many things." },
  { role: "assistant", text: "Fair. What would you **push back on** in my review comment?" },
  { role: "user", text: "eu discordo mas não quero parecer grosso", codeSwitch: true, codeSwitchInput: "voice", durationMs: 2000 },
  { role: "user", text: "I think your comment is not correct." },
];
const input = {
  turns,
  level: "B1",
  scenario: "Disagree with a code review comment",
  functions: [{ id: "estimate-uncertainty", label: "estimate with uncertainty" }, { id: "disagree-politely", label: "disagree politely" }],
  knownPatternLabels: ["soften-disagreement"],
};

function gap(overrides: Record<string, unknown> = {}) {
  return {
    kind: "unnatural",
    evidence: "I think your comment is not correct",
    askedIn: null,
    intent: "discordar sem ser grosso",
    natural: { casual: "I'm not sure I agree here", neutral: "I see it a bit differently" },
    why: "Suaviza a discordância.",
    functionId: "disagree-politely",
    patternLabel: "soften-disagreement",
    severity: "medium",
    ...overrides,
  };
}

describe("buildGapReviewPrompt", () => {
  it("sends the whole conversation, the partner's turns and the travei stretches included", () => {
    const prompt = buildGapReviewPrompt(input);
    expect(prompt).toContain("1. Partner: So when do you think the migration will be done?");
    expect(prompt).toContain("4. Learner (stuck, said in Portuguese): eu discordo mas não quero parecer grosso");
    expect(prompt).toContain("push back on");
    expect(prompt).not.toContain("**");
    expect(prompt).toContain("disagree-politely (disagree politely)");
    expect(prompt).toContain("soften-disagreement");
    expect(prompt).toContain("Brazilian Portuguese");
  });

  it("explains in Portuguese for B1/B2 and in English from C1", () => {
    expect(gapExplanationLanguage("B2")).toBe("pt");
    expect(gapExplanationLanguage("C1")).toBe("en");
  });
});

describe("parseGapReview", () => {
  it("never breaks the review on a malformed reply", () => {
    expect(parseGapReview("I could not find anything useful.", input)).toEqual({ strengths: [], gaps: [], malformed: true });
    expect(parseGapReview("{ not json", input)).toMatchObject({ gaps: [], malformed: true });
    expect(parseGapReview({ strengths: "nice", gaps: "none" }, input)).toMatchObject({ strengths: [], gaps: [], malformed: true });
    expect(parseGapReview(JSON.stringify({ strengths: [], gaps: [null, 3, "x"] }), input)).toEqual({ strengths: [], gaps: [] });
  });

  it("reads JSON wrapped in prose or a code fence", () => {
    const review = parseGapReview(`Here you go:\n\`\`\`json\n${JSON.stringify({ strengths: ["Você explicou o contexto."], gaps: [gap()] })}\n\`\`\``, input);
    expect(review.strengths).toEqual(["Você explicou o contexto."]);
    expect(review.gaps).toHaveLength(1);
  });

  it("discards a gap without the learner's real words", () => {
    const review = parseGapReview({ gaps: [gap({ evidence: "I disagree strongly with you" }), gap({ evidence: "" })] }, input);
    expect(review.gaps).toEqual([]);
  });

  it("keeps avoidance only with the partner's question and the answer that went around it", () => {
    const avoidance = { kind: "avoidance", evidence: "It is difficult. We have many things", patternLabel: "estimate-with-uncertainty",
      natural: { casual: "Probably two weeks, but it depends on the review", neutral: "My best estimate is two weeks" }, intent: "dar uma estimativa" };
    expect(parseGapReview({ gaps: [{ ...avoidance, askedIn: null }] }, input).gaps).toEqual([]);
    expect(parseGapReview({ gaps: [{ ...avoidance, askedIn: "When can you ship it?" }] }, input).gaps).toEqual([]);
    const kept = parseGapReview({ gaps: [{ ...avoidance, askedIn: "when do you think the migration will be done?" }] }, input).gaps;
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ kind: "avoidance", askedIn: "when do you think the migration will be done?", severity: "medium" });
  });

  it("recognizes a travei stretch as proof, filling defaults the model left out", () => {
    const [found] = parseGapReview({ gaps: [{ evidence: "eu discordo mas não quero parecer grosso", natural: "I see it differently", patternLabel: "Soften Disagreement!" }] }, input).gaps;
    expect(found).toMatchObject({
      kind: "code_switch",
      intent: "eu discordo mas não quero parecer grosso",
      natural: { casual: "I see it differently", neutral: "I see it differently" },
      patternLabel: "soften-disagreement",
    });
    expect(found).not.toHaveProperty("functionId");
  });

  it("drops a function the profile does not have", () => {
    expect(parseGapReview({ gaps: [gap({ functionId: "invented" })] }, input).gaps[0]).not.toHaveProperty("functionId");
  });

  it("keeps at most 3, recurring first, then tied to a function, then by severity", () => {
    const review = parseGapReview({
      gaps: [
        gap({ patternLabel: "new-low", functionId: null, severity: "low" }),
        gap({ patternLabel: "new-high", functionId: null, severity: "high" }),
        gap({ patternLabel: "new-function", severity: "low" }),
        gap({ patternLabel: "soften-disagreement", functionId: null, severity: "low" }),
        gap({ patternLabel: "new-medium", functionId: null, severity: "medium" }),
      ],
    }, input);
    expect(review.gaps.map((item) => item.patternLabel)).toEqual(["soften-disagreement", "new-function", "new-high"]);
  });

  it("does not report the same pattern and words twice", () => {
    expect(parseGapReview({ gaps: [gap(), gap({ evidence: "I think your comment is NOT correct." })] }, input).gaps).toHaveLength(1);
  });
});

describe("pattern labels", () => {
  it("stay stable kebab-case", () => {
    expect(normalizePatternLabel("  Estimate with Uncertainty ")).toBe("estimate-with-uncertainty");
    expect(normalizePatternLabel("discordância_educada")).toBe("discordancia-educada");
    expect(rankGaps([] as ReviewedGap[])).toEqual([]);
  });
});
