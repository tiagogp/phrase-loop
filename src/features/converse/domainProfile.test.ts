import { describe, expect, it } from "vitest";
import softwareDev from "./domainProfiles/software-dev.json";
import { domainProfile, profileTopics, validateDomainProfile } from "./domainProfile";
import { buildConverseSystem } from "@/lib/cards/shared";

describe("software-dev domain profile", () => {
  it("is structurally valid", () => {
    expect(validateDomainProfile(softwareDev)).toEqual([]);
  });

  it("has the product owner's 12 scenarios", () => {
    expect(domainProfile("software-dev").scenarios.map((scenario) => scenario.id)).toEqual([
      "daily-standup", "code-review-disagree", "incident-explain", "estimate-uncertainty", "defend-tradeoff", "slack-ask-help",
      "say-no-pm", "client-demo", "one-on-one", "tech-interview", "onboarding-colleague", "remote-small-talk",
    ]);
  });

  it("never claims an expression was reviewed by a human", () => {
    const expressions = domainProfile("software-dev").scenarios.flatMap((scenario) => scenario.expressions);
    expect(expressions.length).toBeGreaterThan(0);
    expect(expressions.every((expression) => expression.reviewed === false)).toBe(true);
  });

  it("catches broken profiles", () => {
    const broken = structuredClone(softwareDev) as { scenarios: { id: string; expressions: { functionId: string; register: string }[] }[] };
    broken.scenarios[1].id = broken.scenarios[0].id;
    broken.scenarios[0].expressions[0].functionId = "missing";
    broken.scenarios[0].expressions[1].register = "formal";
    const errors = validateDomainProfile(broken);
    expect(errors).toContain("scenarios[1] repeats id daily-standup.");
    expect(errors).toContain("scenarios[0].expressions[0] points to an unknown function.");
    expect(errors).toContain("scenarios[0].expressions[1] register must be casual or neutral.");
    expect(validateDomainProfile(null)).toEqual(["Profile must be an object."]);
  });
});

describe("profile topics", () => {
  it("shows labels in the interface language and sends English functions to the prompt", () => {
    const [daily] = profileTopics("software-dev", "pt");
    expect(daily.label).toBe("Daily");
    expect(daily.displaySituation).toContain("Você dá seu update");
    expect(daily.situation).toContain("Daily stand-up of a remote software team");
    const system = buildConverseSystem({
      scenario: daily.situation, targetLang: "en", sourceLang: "pt", level: "B1",
      longSession: { aiRole: daily.aiRole, functions: daily.functions?.map((fn) => fn.label) },
    });
    expect(system).toContain("raise a blocker and ask for what you need");
    expect(system).toContain("the engineering manager running the stand-up");
  });
});
