import { describe, expect, it } from "vitest";
import { tutorCompletion } from "./completion";
import { durationHistory, tutorAttempt, tutorSession } from "./testFixtures";
const preferences = { id: "preferences" as const, goal: "", explanationLanguage: "pt" as const, ignoredEvidenceIds: [] };
describe("completion presentation", () => {
  it("shows specific success without inventing a previous answer", () => {
    const session = tutorSession({ attempts: [tutorAttempt()] });
    expect(tutorCompletion(session, [], preferences)).toEqual({ achievement: session.task.successCriteria, comparison: undefined });
  });
  it("compares the same skill with support and interval", () => {
    const [previous, current] = durationHistory();
    expect(tutorCompletion(current, [previous], preferences).comparison).toMatchObject({ days: 1, previousSupported: true, currentSupported: false });
    expect(tutorCompletion({ ...current, skill: { ...current.skill!, conceptId: "polite-requests" } }, [previous], preferences).comparison).toBeUndefined();
  });
  it("never claims achievement for uncertain, disputed, excluded or empty attempts", () => {
    const attempt = tutorAttempt();
    for (const attempts of [[], [{ ...attempt, disputed: true }], [{ ...attempt, feedback: { ...attempt.feedback, status: "uncertain" as const } }]]) {
      expect(tutorCompletion(tutorSession({ attempts }), [], preferences).achievement).toBeUndefined();
    }
    expect(tutorCompletion(tutorSession({ attempts: [attempt] }), [], { ...preferences, ignoredEvidenceIds: [`tutor:${attempt.id}`] }).achievement).toBeUndefined();
    expect(tutorCompletion(tutorSession({ attempts: [{ ...attempt, feedback: { ...attempt.feedback, status: "partial", skill: { ...attempt.feedback.skill!, result: "demonstrated" } } }] }), [], preferences).achievement).toBeTruthy();
  });
});
