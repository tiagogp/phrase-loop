import { describe, expect, it } from "vitest";
import { deriveExperience } from "./experience";
import { DEFAULT_TUTOR_PREFERENCES } from "@/features/tutor/model";
import { durationHistory, tutorAttempt, tutorSession } from "@/features/tutor/testFixtures";
import type { Card } from "@/lib/cards/schema";
import type { ReviewRecord } from "@/lib/store/repository";

const base = { sessions: [], cards: [], reviews: [], preferences: DEFAULT_TUTOR_PREFERENCES };
describe("experience from learning activity", () => {
  it("does not count opening and immediately ending a session as activation", () => {
    expect(deriveExperience(base).stage).toBe("new");
    expect(deriveExperience({ ...base, sessions: [tutorSession({ phase: "complete", completedAt: 4000 })] }).firstLoopComplete).toBe(false);
  });
  it("keeps unfinished work available and distinguishes feedback from a completed loop", () => {
    const session = tutorSession({ phase: "feedback", attempts: [tutorAttempt()] });
    expect(deriveExperience({ ...base, sessions: [session] })).toMatchObject({ stage: "first_result", active: session, firstLoopComplete: false });
  });
  it("requires a retry or an initially met task before a completed tutor loop", () => {
    const [session] = durationHistory();
    expect(deriveExperience({ ...base, sessions: [session] }).stage).toBe("first_loop");
    expect(deriveExperience({ ...base, sessions: [{ ...session, attempts: session.attempts.slice(0, 1) }] }).stage).toBe("first_result");
  });
  it("does not promote disputed, uncertain or excluded results", () => {
    const session = tutorSession({ phase: "complete", completedAt: 4000, attempts: [tutorAttempt({ disputed: true })] });
    expect(deriveExperience({ ...base, sessions: [session] }).firstLoopComplete).toBe(false);
    session.attempts = [tutorAttempt({ feedback: { ...tutorAttempt().feedback, status: "uncertain" } })];
    expect(deriveExperience({ ...base, sessions: [session] }).hasResult).toBe(false);
    session.attempts = [tutorAttempt()];
    expect(deriveExperience({ ...base, sessions: [session], preferences: { ...base.preferences, ignoredEvidenceIds: ["tutor:attempt-1"] } }).hasResult).toBe(false);
  });
  it("uses delayed practice and actual own-source practice for familiarity, never clicks", () => {
    const [origin, followup] = durationHistory();
    expect(deriveExperience({ ...base, sessions: [origin, followup] }).stage).toBe("familiar");
    expect(deriveExperience({ ...base, sessions: [origin, { ...followup, sourceCardId: "own" }] }).stage).toBe("power");
    expect(deriveExperience({ ...base, sessions: [origin, tutorSession({ sourceCardId: "own" })] }).stage).toBe("first_loop");
  });
  it("distinguishes importing from reviewing and respects legacy review history", () => {
    expect(deriveExperience({ ...base, cards: [{ id: "own" } as Card] })).toMatchObject({ stage: "first_action", discovery: "review" });
    expect(deriveExperience({ ...base, reviews: [{ cardId: "removed", reviewedAt: 1000 } as ReviewRecord] }).stage).toBe("first_loop");
  });
});
