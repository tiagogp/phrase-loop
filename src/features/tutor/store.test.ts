import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { clearAll, getAll, STORES } from "@/lib/store/db";
import { exportLocalBackup, getProductionAttempts, restoreLocalBackup, validateLocalBackup } from "@/lib/store/repository";
import { getTutorSessions, recordTutorExposure, saveTutorPreferences, saveTutorSession } from "./store";
import { tutorSkillEvidence } from "./model";
import { tutorAttempt, tutorSession, durationHistory } from "./testFixtures";

beforeEach(() => clearAll());
describe("tutor persistence", () => {
  it("restores a skill and independent day-two use as one learning history", async () => {
    const [initial, followup] = durationHistory();
    const skill = initial.skill!;
    await saveTutorSession(initial, 0);
    await saveTutorSession(followup, 0);
    const backup = JSON.parse(JSON.stringify(await exportLocalBackup()));
    await clearAll();
    expect((await restoreLocalBackup(backup)).ok).toBe(true);
    expect(tutorSkillEvidence(await getTutorSessions(), skill)).toMatchObject({ initialDifficulty: true, assisted: 1, transfers: 1, contexts: 1 });
  });
  it("persists history exposure atomically and rejects a stale active writer", async () => {
    const [initial] = durationHistory();
    await saveTutorSession(initial, 0);
    await recordTutorExposure([initial.id, initial.id], "history", 90_000_000);
    const saved = (await getTutorSessions())[0];
    expect(saved.revision).toBe(2);
    expect(saved.updatedAt).toBe(initial.updatedAt);
    expect(saved.exposures?.at(-1)).toMatchObject({ kind: "history", at: 90_000_000 });
    await expect(saveTutorSession({ ...initial, revision: 2, draft: "stale" }, 1)).rejects.toThrow();
    const backup = JSON.parse(JSON.stringify(await exportLocalBackup()));
    await clearAll(); await restoreLocalBackup(backup);
    expect((await getTutorSessions())[0].exposures).toEqual(saved.exposures);
  });
  it("resumes the exact draft and linked attempts after a portable backup round-trip", async () => {
    const initial = tutorSession({ draft: "I want change" });
    await saveTutorSession(initial, 0);
    expect((await getTutorSessions())[0].draft).toBe("I want change");
    const next = { ...initial, revision: 2, phase: "feedback" as const, attempts: [tutorAttempt()] };
    await saveTutorSession(next, 1);
    const backup = JSON.parse(JSON.stringify(await exportLocalBackup()));
    await clearAll();
    expect((await restoreLocalBackup(backup)).ok).toBe(true);
    expect(await getTutorSessions()).toEqual([next]);
    expect((await getProductionAttempts())[0].text).toBe(tutorAttempt().text);
    expect(await getAll(STORES.reviews)).toHaveLength(0);
    expect(await getAll(STORES.srs)).toHaveLength(0);
  });
  it("does not consume a parent's reminder until the follow-up has a real attempt", async () => {
    const parent = tutorSession({ phase: "complete", attempts: [tutorAttempt()], nextReviewAt: 1000 });
    await saveTutorSession(parent, 0);
    const child = tutorSession({ id: "child", parentSessionId: parent.id });
    await saveTutorSession(child, 0);
    expect((await getTutorSessions()).find(s => s.id === parent.id)?.revisitedAt).toBeUndefined();
    await saveTutorSession({ ...child, revision: 2, attempts: [tutorAttempt({ id: "child-attempt", createdAt: 5000 })] }, 1);
    expect((await getTutorSessions()).find(s => s.id === parent.id)).toMatchObject({ revisitedAt: 5000, revision: 2 });
  });
  it("rejects a stale second window atomically, keeping both the draft and evidence", async () => {
    await saveTutorSession(tutorSession(), 0);
    const winner = { ...tutorSession(), revision: 2, draft: "winning draft" };
    const loser = { ...tutorSession(), revision: 2, attempts: [tutorAttempt()] };
    const results = await Promise.allSettled([saveTutorSession(winner, 1), saveTutorSession(loser, 1)]);
    expect(results.map(r => r.status)).toEqual(["fulfilled", "rejected"]);
    expect((await getTutorSessions())[0].draft).toBe("winning draft");
    expect(await getProductionAttempts()).toHaveLength(0);
  });
  it("rejects malformed tutor imports and keeps preferences in ordinary backup and wipe", async () => {
    await saveTutorPreferences({ id: "preferences", goal: "Work", explanationLanguage: "en", ignoredEvidenceIds: ["review:1"] });
    const backup = await exportLocalBackup();
    expect(validateLocalBackup(backup).ok).toBe(true);
    expect(validateLocalBackup({ ...backup, stores: { tutorSessions: [{ id: "invalid" }] } }).ok).toBe(false);
    await clearAll();
    expect(await getAll(STORES.tutorPreferences)).toHaveLength(0);
    expect((await restoreLocalBackup(backup)).ok).toBe(true);
    expect(await getAll(STORES.tutorPreferences)).toEqual(backup.stores.tutorPreferences);
  });
});

it("atomically limits optional starts to two even in concurrent windows", async () => {
  const results = await Promise.allSettled([1, 2, 3].map(i => saveTutorSession(tutorSession({ id: `extra-${i}`, extraPractice: true, createdAt: 10_000 }), 0)));
  expect(results.filter(r => r.status === "fulfilled")).toHaveLength(2);
  expect(await getTutorSessions()).toHaveLength(2);
  const saved = (await getTutorSessions())[0];
  await expect(saveTutorSession({ ...saved, revision: 2, draft: "I can still continue" }, 1)).resolves.toBeUndefined();
  await expect(saveTutorSession(tutorSession({ id: "tomorrow", extraPractice: true, createdAt: 86_410_000 }), 0)).resolves.toBeUndefined();
});
