import { describe, expect, it } from "vitest";
import { DEFAULT_LEARNING_PROFILE } from "@/features/settings/learningProfile";
import { DEFAULT_TUTOR_PREFERENCES, allowedTutorEvidence, nextTutorReview, selectTutorEvidence, skillFromFirstAttempt, tutorObservations, tutorProduction, tutorRecommendation, tutorSkillEvidence, tutorSummary } from "./model";
import { isTutorFeedback, isTutorRequest, isTutorSession } from "./contract";
import { tutorAttempt, tutorSession, durationHistory } from "./testFixtures";
import { buildTutorPhrase } from "./phrase";
import { buildTutorPrompt } from "./prompts";
import { deriveLearningEvidence } from "@/features/progress/learningEvidence";

const DAY = 86_400_000;
describe("continuous tutor learning contract", () => {
  it("carries one difficulty from day 1 into a different day 2 context and credits only unaided transfer", () => {
    const [origin, followup] = durationHistory();
    const first = origin.attempts[0];
    const skill = skillFromFirstAttempt(origin, first)!;
    origin.skill = skill;
    expect(tutorSkillEvidence([origin], skill)).toMatchObject({ initialDifficulty: true, assisted: 1, transfers: 0 });
    expect(tutorRecommendation([origin], DEFAULT_TUTOR_PREFERENCES, DEFAULT_LEARNING_PROFILE, 4000 + DAY)).toMatchObject({ focus: origin.task.goal, due: { id: origin.id } });
    expect(tutorSkillEvidence([origin, followup], skill)).toMatchObject({ assisted: 1, independent: 1, transfers: 1, contexts: 1 });
    expect(nextTutorReview(followup, 5000 + DAY, [origin])).toBe(5000 + 8 * DAY);
    expect(nextTutorReview({ ...followup, attempts: [{ ...followup.attempts[0], supportUsed: true }] }, 5000 + DAY, [origin])).toBe(5000 + 2 * DAY);
    const copied = { ...followup, attempts: [tutorAttempt({ id: "copied", text: origin.attempts[1].text, feedback: { ...tutorAttempt().feedback, skill: { label: skill.label, result: "demonstrated" } } })] };
    expect(tutorSkillEvidence([origin, copied], skill).transfers).toBe(0);
    expect(tutorSkillEvidence([origin, { ...followup, attempts: [{ ...followup.attempts[0], supportUsed: true }] }], skill).transfers).toBe(0);
  });
  it("resumes an unfinished session before recommending a due return", () => {
    const due = tutorSession({ id: "old", phase: "complete", attempts: [tutorAttempt()], nextReviewAt: 100 });
    const active = tutorSession();
    expect(tutorRecommendation([due, active], DEFAULT_TUTOR_PREFERENCES, DEFAULT_LEARNING_PROFILE, 1000).active?.id).toBe(active.id);
    expect(tutorRecommendation([due], DEFAULT_TUTOR_PREFERENCES, DEFAULT_LEARNING_PROFILE, 1000).due?.id).toBe(due.id);
    expect(tutorRecommendation([{ ...due, revisitedAt: 500 }], DEFAULT_TUTOR_PREFERENCES, DEFAULT_LEARNING_PROFILE, 1000).due).toBeUndefined();
    expect(tutorRecommendation([due], { ...DEFAULT_TUTOR_PREFERENCES, ignoredEvidenceIds: ["session:old"] }, DEFAULT_LEARNING_PROFILE, 1000).due).toBeUndefined();
  });
  it("schedules actual attempts and returns sooner after support, uncertainty or dispute", () => {
    expect(nextTutorReview(tutorSession(), 1000)).toBeUndefined();
    expect(nextTutorReview(tutorSession({ attempts: [tutorAttempt({ disputed: true })] }), 1000)).toBeUndefined();
    const independent = tutorSession({ attempts: [tutorAttempt()] });
    expect(nextTutorReview(independent, 1000)).toBe(1000 + 3 * DAY);
    for (const attempt of [tutorAttempt({ supportUsed: true }), tutorAttempt({ feedback: { ...tutorAttempt().feedback, status: "uncertain" } })]) {
      expect(nextTutorReview(tutorSession({ attempts: [attempt] }), 1000)).toBe(1000 + DAY);
    }
  });
  it("records retry linkage without turning a model teaching point into general accuracy or transfer", () => {
    const first = tutorAttempt();
    const retry = tutorAttempt({ id: "retry", supportUsed: true });
    const session = tutorSession({ attempts: [first, retry] });
    const production = session.attempts.map(a => tutorProduction(session, a));
    expect(production[1]).toMatchObject({ retryOf: first.id, stage: "retry", scaffoldUsed: true, evaluated: false });
    expect(production[0].transferVerified).toBeUndefined();
    const evidence = deriveLearningEvidence({ cards: [], reviews: [], production, retries: [], listening: [], proofs: [] }, 3000);
    expect(evidence.wins).toHaveLength(0);
    expect(tutorSummary(session)).toContain("após apoio ou feedback");
    expect(tutorSummary(tutorSession())).toContain("Nenhum resultado");
  });
  it("preserves dates, support and provenance without duplicating tutor observations", () => {
    const attempt = tutorAttempt();
    const session = tutorSession({ attempts: [attempt, tutorAttempt({ id: "contested", disputed: true })] });
    const observed = tutorObservations({ cards: [], production: [tutorProduction(session, attempt)], reviews: [], sessions: [session] });
    expect(observed).toHaveLength(1);
    expect(observed[0]).toMatchObject({ id: `tutor:${attempt.id}`, text: attempt.text, createdAt: attempt.createdAt, supported: false });
    expect(observed[0].detail).toContain("avaliação de IA");
  });
  it("keeps a generated phrase's source and both recall directions", async () => {
    const result = await buildTutorPhrase(tutorSession({ attempts: [tutorAttempt()] }));
    expect(result.candidate.sourceId).toBe("tutor:session-1");
    expect(result.cards.map(c => c.direction)).toEqual(["recognition", "production"]);
    expect(result.cards[1].back).toBe(tutorAttempt().feedback.example.english);
    expect(result.cards[0].context).toContain("gerado pelo tutor");
    await expect(buildTutorPhrase(tutorSession({ attempts: [tutorAttempt({ disputed: true })] }))).rejects.toThrow();
  });
  it("retrieves the old linked response, limits context and respects later exclusions and disputes", () => {
    const parent = tutorSession({ attempts: [tutorAttempt({ id: "old" })] });
    const observations = Array.from({ length: 12 }, (_, i) => ({ id: `production:${i}`, kind: "production" as const, label: "Prática", text: "Another response", detail: "", createdAt: 5000 + i, supported: null }));
    const evidence = selectTutorEvidence({ observations, sessions: [parent], preferences: DEFAULT_TUTOR_PREFERENCES, focus: parent.task.goal, parent });
    expect(evidence).toHaveLength(6);
    expect(evidence[0].id).toBe("tutor:old");
    expect(allowedTutorEvidence(evidence, { ...DEFAULT_TUTOR_PREFERENCES, ignoredEvidenceIds: ["tutor:old"] }, [parent])).toHaveLength(5);
    expect(allowedTutorEvidence(evidence, DEFAULT_TUTOR_PREFERENCES, [{ ...parent, attempts: [tutorAttempt({ id: "old", disputed: true })] }])).toHaveLength(5);
  });
  it("rejects malformed output, excessive context, impossible attempts and invalid backup records", () => {
    expect(isTutorFeedback({ ...tutorAttempt().feedback, status: "mastered" })).toBe(false);
    expect(isTutorFeedback({ ...tutorAttempt().feedback, points: [{ original: "invented" }] })).toBe(false);
    expect(isTutorSession(tutorSession({ attempts: Array(4).fill(tutorAttempt()) }))).toBe(false);
    expect(isTutorSession({ id: "x" })).toBe(false);
    expect(isTutorRequest({ provider: "ollama", action: "evaluate", task: tutorSession().task, text: " ", context: { level: "A2", minutes: 5, focus: "Goal", explanationLanguage: "pt", evidence: [] } })).toBe(false);
  });
  it("tells the model to vary the follow-up situation and not reveal a solution first", () => {
    const prompt = buildTutorPrompt({ provider: "ollama", action: "plan", context: { level: "A2", minutes: 5, focus: "Remarcar", explanationLanguage: "pt", evidence: [], previousTask: tutorSession().task } });
    expect(prompt).toContain("DIFFERENT concrete situation");
    expect(prompt).toContain("Do not reveal a model answer");
    expect(prompt).toContain("never a complete learner profile");
    expect(prompt).not.toContain("apiKey");
  });
});
