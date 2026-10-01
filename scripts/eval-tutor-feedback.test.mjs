import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { agreementReport, evaluateCases } from "./eval-tutor-feedback.mjs";
import { TUTOR_CONCEPTS, tutorScenarioFor, verifiedTutorContext } from "../src/features/tutor/catalog";
import { buildTutorPrompt } from "../src/features/tutor/prompts";
import { isTutorFeedback } from "../src/features/tutor/contract";
import { extractJsonObject } from "../src/features/plan/contract";
import { tutorAttempt } from "../src/features/tutor/testFixtures";
const cases = JSON.parse(await readFile(new URL("./content/tutor-feedback-cases.json", import.meta.url), "utf8"));
it("covers all catalog skills with six required kinds, pending editorial review", () => {
  expect(cases.length).toBeGreaterThanOrEqual(40);
  for (const concept of Object.keys(TUTOR_CONCEPTS)) {
    expect(new Set(cases.filter(c => c.conceptId === concept).map(c => c.kind)).size).toBe(6);
  }
  for (const item of cases) expect(verifiedTutorContext(tutorScenarioFor(item.scenarioId), item.conceptId)).toBeTruthy();
});
it("uses the shared prompt and counts malformed feedback as disagreement", async () => {
  let prompt;
  const runtime = { buildTutorPrompt, TUTOR_CONCEPTS, tutorScenarioFor, isTutorFeedback, extractJsonObject };
  const rows = await evaluateCases([cases[6], cases[7]], { runtime, provider: "ollama", complete: async p => {
    prompt = p;
    return rowsCalls++ === 0 ? JSON.stringify(tutorAttempt().feedback) : "invalid";
  } });
  expect(prompt).toContain("Never infer pronunciation from text");
  expect(agreementReport(rows)).toMatchObject({ cases: 2, matches: 1, invalid: 1, bySkill: { "polite-requests": { cases: 2, agreement: 0.5 } } });
});
let rowsCalls = 0;
