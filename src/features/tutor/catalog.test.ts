import { describe, expect, it } from "vitest";
import { chooseTutorScenario, TUTOR_CONCEPTS, tutorScenarios, verifiedTutorContext } from "./catalog";
import { buildTutorPrompt } from "./prompts";
import { tutorSession } from "./testFixtures";
import { isTutorFeedback } from "./contract";
import { tutorAttempt } from "./testFixtures";
import { localizeTutorText } from "./localization";

describe("authored catalog", () => {
  it("covers eight skills with varied verified contexts and bilingual tasks", () => {
    expect(Object.keys(TUTOR_CONCEPTS)).toHaveLength(8);
    for (const [id, concept] of Object.entries(TUTOR_CONCEPTS)) {
      const scenarios = tutorScenarios.filter(s => s.conceptId === id);
      expect(scenarios.length).toBeGreaterThanOrEqual(3);
      expect(new Set(scenarios.map(s => s.contextId)).size).toBe(scenarios.length);
      expect(localizeTutorText(concept.label, "en")).not.toBe(concept.label);
      for (const scenario of scenarios) {
        expect(verifiedTutorContext(scenario.task, id)).toBe(scenario.contextId);
        expect(verifiedTutorContext({ ...scenario.task, instruction: "Changed" }, id)).toBeUndefined();
        for (const key of ["goal", "situation", "successCriteria"] as const) {
          expect(localizeTutorText(scenario.task[key], "pt")).not.toBe(localizeTutorText(scenario.task[key], "en"));
        }
        expect(JSON.stringify(scenario.task)).not.toMatch(/present perfect|past simple|could you|you should say|model answer/i);
      }
      const first = chooseTutorScenario(id, [])!;
      expect(chooseTutorScenario(id, [tutorSession({ task: first })])?.scenarioId).not.toBe(first.scenarioId);
      expect(isTutorFeedback({ ...tutorAttempt().feedback, skill: { label: concept.label, conceptId: id, result: "demonstrated" } })).toBe(true);
    }
  });
  it("derives prompt concept IDs from the catalog", () => {
    const prompt = buildTutorPrompt({ action: "evaluate", provider: "ollama", context: { level: "A2", minutes: 5, explanationLanguage: "pt", focus: "work", evidence: [] }, task: tutorSession().task, text: "test" });
    expect(prompt).toContain(`${Object.keys(TUTOR_CONCEPTS).join("|")}|unclassified`);
    for (const concept of Object.values(TUTOR_CONCEPTS)) expect(prompt).toContain(concept.rubric);
  });
});
