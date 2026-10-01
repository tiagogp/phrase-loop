import { expect, it } from "vitest";
import { AI_SETUP_STEPS, aiSetupStep, connectionNextStep } from "./aiSetup";
import { translate } from "@/i18n/translate";
it("guides a connection in no more than three steps", () => {
  expect(AI_SETUP_STEPS).toHaveLength(3);
  expect(aiSetupStep({ selected: false, ready: false, connected: false })).toBe(1);
  expect(aiSetupStep({ selected: true, ready: false, connected: false })).toBe(2);
  expect(aiSetupStep({ selected: true, ready: true, connected: false })).toBe(3);
  expect(aiSetupStep({ selected: true, ready: false, connected: true })).toBe(3);
});
it("gives actionable bilingual recovery without exposing technical provider errors", () => {
  for (const kind of ["openai", "claude", "openrouter", "ollama"] as const) {
    expect(connectionNextStep(kind)).toContain("continue without AI");
    expect(translate("pt", connectionNextStep(kind))).toContain("sem IA");
    expect(translate("pt", connectionNextStep(kind))).not.toBe(connectionNextStep(kind));
  }
});
