import { describe, expect, it } from "vitest";
import { buildPilotExport, type PilotHistory } from "./pilotExport";
import { DAY, durationHistory, tutorAttempt, tutorSession } from "@/features/tutor/testFixtures";
import { tutorProduction } from "@/features/tutor/model";
import { localProduction } from "@/features/learn/localProduction";
import { firstLesson } from "@/features/learn/lessonDeck";
const preferences = { id: "preferences" as const, goal: "private goal", explanationLanguage: "pt" as const, ignoredEvidenceIds: [] };
const empty: PilotHistory = { sessions: [], preferences, production: [], reviews: [], activities: [], retries: [] };
describe("local pilot metrics", () => {
  it("derives timing, retries, return intervals and support without counting projected tutor attempts twice", () => {
    const [origin, return1] = durationHistory();
    const return7 = { ...return1, id: "d7", createdAt: 7 * DAY + 4000, attempts: [tutorAttempt({ id: "d7-answer", createdAt: 7 * DAY + 4500 })], completedAt: 7 * DAY + 5000 };
    const history = { ...empty, sessions: [origin, return1, return7], production: [tutorProduction(origin, origin.attempts[0])] };
    const report = buildPilotExport(history, 12 * DAY);
    expect(report.timeToFirstAttemptMs).toBe(1000);
    expect(report.firstPracticeCompleted?.at).toBe(4000);
    expect(report.retries.tutorAttempts).toBe(1);
    expect(report.returns.d1.attempts).toHaveLength(1);
    expect(report.returns.d7.attempts).toHaveLength(1);
    expect(report.support.tutorAttempts).toBe(1);
    expect(report.bySkill["present-perfect-duration"].situations["duration-remote-v1"]).toBe(2);
    expect(report.tutorAttempts).toHaveLength(4);
    for (const text of [origin.attempts[0].text, origin.task.situation, origin.attempts[0].feedback.example.english, preferences.goal]) expect(JSON.stringify(report)).not.toContain(text);
    expect(report).not.toHaveProperty("answers");
    expect(buildPilotExport(history, 12 * DAY, true).answers?.[0].text).toBe(origin.attempts[0].text);
  });
  it("distinguishes local self-assessment, missing timing and incomplete observation windows", () => {
    const local = { ...localProduction(firstLesson(), "Local answer", 1000, 2000, "local"), finished: true, completedAt: 3000, selfAssessment: "communicated" as const };
    const report = buildPilotExport({ ...empty, production: [local] }, 4000);
    expect(report.timeToFirstAttemptMs).toBeNull();
    expect(report.firstPracticeCompleted).toEqual({ at: 3000, kind: "local_self_assessment", assessed: false });
    expect(report.returns.d7.windowComplete).toBe(false);
    expect(buildPilotExport(empty, 4000).firstPracticeCompleted).toBeNull();
  });
  it("excludes uncertain/disputed completions and never exports arbitrary model context IDs", () => {
    const session = tutorSession({ phase: "complete", completedAt: 4000, skill: { id: "polite-requests", conceptId: "polite-requests", label: "private label", originContext: "private context" },
      attempts: [tutorAttempt({ disputed: true })], task: { ...tutorSession().task, scenarioId: "private free text" } });
    const report = buildPilotExport({ ...empty, sessions: [session] }, 5000);
    expect(report.firstPracticeCompleted).toBeNull();
    expect(report.tutorAttempts[0]).toMatchObject({ scenarioId: null, assessmentIncluded: false });
    expect(JSON.stringify(report)).not.toContain("private");
    expect(buildPilotExport({ ...empty, sessions: [{ ...session, attempts: [{ ...tutorAttempt(), feedback: { ...tutorAttempt().feedback, status: "uncertain" } }] }] }, 5000).firstPracticeCompleted).toBeNull();
  });
});
