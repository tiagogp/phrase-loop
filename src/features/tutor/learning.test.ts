import { describe, expect, it } from "vitest";
import { chooseTutorScenario, tutorScenarioFor, verifiedTutorContext } from "./catalog";
import { tutorSkillEvidence, uniqueTutorSkills } from "./learning";
import { DEFAULT_TUTOR_PREFERENCES, nextTutorReview, tutorRecommendation } from "./model";
import { DEFAULT_LEARNING_PROFILE } from "@/features/settings/learningProfile";
import { DAY, durationHistory, tutorAttempt, tutorSession } from "./testFixtures";

import type { TutorSession } from "./types";

const evidenceFor = (sessions: TutorSession[] = durationHistory()) => tutorSkillEvidence(sessions, sessions[0].skill!);
describe("valid learning evidence", () => {
  it("recognizes a later verified context, regardless of session creation time", () => {
    const history = durationHistory();
    history[1].createdAt = 1000;
    expect(evidenceFor(history)).toMatchObject({ initialDifficulty: true, assisted: 1, improvements: 1, independent: 1, transfers: 1, contexts: 1, state: "transfer_observed" });
    expect(evidenceFor(history).after?.attempt.id).toBe("remote");
  });
  it("rejects paraphrased situations and forged scenario IDs as transfer proof", () => {
    const [origin, followup] = durationHistory();
    followup.task.situation = "Um colega pergunta há quanto tempo você usa React no trabalho.";
    expect(verifiedTutorContext(followup.task, origin.skill!.conceptId)).toBeUndefined();
    expect(evidenceFor([origin, followup]).transfers).toBe(0);
    delete followup.task.scenarioId;
    expect(evidenceFor([origin, followup]).transfers).toBe(0);
  });
  it("uses the last exposure and actual submission time, including help in another session", () => {
    const [origin, followup] = durationHistory();
    origin.exposures!.push({ id: "read-history", kind: "history", at: DAY });
    expect(evidenceFor([origin, followup])).toMatchObject({ transfers: 0, independent: 0, assisted: 2 });
    followup.attempts[0].createdAt = 2 * DAY;
    followup.exposures = [{ id: "feedback-later", kind: "feedback", at: 2 * DAY + 1 }];
    expect(evidenceFor([origin, followup]).transfers).toBe(1);
    origin.exposures!.push({ id: "read-after-answer", kind: "history", at: 3 * DAY });
    expect(evidenceFor([origin, followup]).transfers).toBe(1);
    expect(nextTutorReview(origin, 4000, [followup])).toBeGreaterThanOrEqual(4 * DAY);
  });
  it("does not let ignored or disputed diagnoses prove later learning", () => {
    const history = durationHistory();
    const ignored = { ...DEFAULT_TUTOR_PREFERENCES, ignoredEvidenceIds: ["tutor:initial"] };
    expect(tutorSkillEvidence(history, history[0].skill!, ignored)).toMatchObject({ initialDifficulty: false, transfers: 0 });
    history[0].attempts[0].disputed = true;
    expect(evidenceFor(history)).toMatchObject({ initialDifficulty: false, transfers: 0 });
  });
  it("counts help before the first answer and one improvement per session", () => {
    const [origin] = durationHistory();
    const correct = { ...origin.attempts[1], id: "first-with-hint", supportUsed: true };
    const hinted = { ...origin, id: "hinted", attempts: [correct], help: [{ question: "Dica?", answer: "Pense na duração.", createdAt: 2500 }] };
    expect(evidenceFor([hinted])).toMatchObject({ assisted: 1, improvements: 0, independent: 0 });
    origin.attempts.push({ ...origin.attempts[1], id: "second-retry", createdAt: 3600 });
    expect(evidenceFor([origin])).toMatchObject({ assisted: 2, improvements: 1 });
  });
  it("does not turn global partial status into a diagnosis of a demonstrated skill", () => {
    const [, followup] = durationHistory();
    followup.attempts[0].feedback.status = "partial";
    expect(evidenceFor([followup])).toMatchObject({ initialDifficulty: false, failed: 0, independent: 1, state: "awaiting_independent" });
    expect(tutorRecommendation([followup], DEFAULT_TUTOR_PREFERENCES, DEFAULT_LEARNING_PROFILE, 10 * DAY).reason).not.toContain("dificuldade");
  });
  it("groups independently started sessions by concept, preserving unknown legacy episodes", () => {
    const [origin, followup] = durationHistory();
    followup.parentSessionId = undefined;
    followup.skill = { ...followup.skill!, id: "unrelated-root", label: "Uma descrição diferente" };
    expect(uniqueTutorSkills([origin, followup])).toHaveLength(1);
    expect(evidenceFor([origin, followup]).transfers).toBe(1);
    const legacy = tutorSession({ id: "legacy", skill: { id: "legacy", label: origin.skill!.label, originContext: "free text" }, attempts: [tutorAttempt()] });
    expect(uniqueTutorSkills([origin, followup, legacy])).toHaveLength(2);
  });
  it("rejects normalized copies of earlier examples and does not count a repeated context twice", () => {
    const [origin, followup] = durationHistory();
    const later = { ...followup, id: "repeat", createdAt: 3 * DAY, completedAt: 3 * DAY + 100, exposures: [{ id: "later-feedback", kind: "feedback" as const, at: 3 * DAY + 100 }], attempts: [{ ...followup.attempts[0], id: "repeated", createdAt: 3 * DAY, text: "I have worked remotely since 2019. I enjoy it." }] };
    expect(evidenceFor([origin, followup, later])).toMatchObject({ independent: 2, transfers: 1 });
    followup.attempts[0].text = "I HAVE BEEN WORKING WITH REACT FOR FIVE YEARS!!!";
    expect(evidenceFor([origin, followup]).transfers).toBe(0);
  });
  it("requires two distinct delayed contexts for consistency and regresses after a new difficulty", () => {
    const [origin, followup] = durationHistory();
    const later = { ...followup, id: "later", task: tutorScenarioFor("duration-learning-v1"), createdAt: 3 * DAY, completedAt: 3 * DAY + 100, exposures: [{ id: "later-feedback", kind: "feedback" as const, at: 3 * DAY + 100 }], attempts: [{ ...followup.attempts[0], id: "learning", createdAt: 3 * DAY, text: "I've studied Rust for six months. It's useful at work." }] };
    expect(evidenceFor([origin, followup, later]).state).toBe("consistent");
    expect(nextTutorReview(later, 3 * DAY + 100, [origin, followup])).toBe(17 * DAY + 100);
    const regression = { ...later, id: "regression", completedAt: 5 * DAY + 100, exposures: [], attempts: [{ ...origin.attempts[0], id: "error-again", createdAt: 5 * DAY }] };
    expect(evidenceFor([origin, followup, later, regression])).toMatchObject({ state: "developing", transfers: 2, recentFailures: 2 });
    expect(nextTutorReview(regression, 5 * DAY + 100, [origin, followup, later])).toBe(6 * DAY + 100);
  });
  it("history opening does not replace the latest practiced session in scheduling", () => {
    const [origin, followup] = durationHistory();
    origin.updatedAt = 30 * DAY;
    const rec = tutorRecommendation([origin, followup], DEFAULT_TUTOR_PREFERENCES, DEFAULT_LEARNING_PROFILE, 20 * DAY);
    expect(rec.due?.id).toBe(followup.id);
    expect(chooseTutorScenario(origin.skill!.conceptId!, [origin, followup])?.scenarioId).toBe("duration-learning-v1");
  });
});
