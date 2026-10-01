import { expect, it } from "vitest";
import { tutorAnswer } from "./answer";
import { tutorProduction } from "./model";
import { tutorAttempt, tutorSession } from "./testFixtures";
import { buildTutorPrompt } from "./prompts";
import { isTutorSession } from "./contract";
it("preserves edited speech provenance without deriving pronunciation", () => {
  const session = tutorSession({ draft: "An edited transcript", draftSpoken: true });
  const sample = tutorAttempt();
  const attempt = tutorAnswer(session, "spoken", 3000, sample.feedback, sample.judge);
  expect(attempt).toMatchObject({ spoken: true, text: "An edited transcript" });
  expect(attempt.feedback).toBe(sample.feedback);
  expect(tutorProduction({ ...session, attempts: [attempt] }, attempt)).toMatchObject({ spoken: true, evaluated: false });
  expect(attempt).not.toHaveProperty("pronunciation");
  expect(isTutorSession({ ...session, attempts: [attempt] })).toBe(true);
  expect(isTutorSession({ ...session, attempts: [{ ...attempt, spoken: "yes" }] })).toBe(false);
  expect(tutorAnswer({ ...session, draftSpoken: undefined }, "text", 3000, sample.feedback, sample.judge).spoken).toBe(false);
  expect(buildTutorPrompt({ action: "evaluate", provider: "ollama", context: { level: "A2", minutes: 5, explanationLanguage: "pt", focus: "", evidence: [] }, task: session.task, text: attempt.text })).toContain("Never infer pronunciation from text");
});
