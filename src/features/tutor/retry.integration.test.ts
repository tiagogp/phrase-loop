import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { clearAll } from "@/lib/store/db";
import { getProductionAttempts } from "@/lib/store/repository";
import { requestTutor } from "./api";
import { tutorAnswer } from "./answer";
import { tutorScenarioFor } from "./catalog";
import { skillFromFirstAttempt } from "./learning";
import { getTutorSessions, saveTutorSession } from "./store";
import { tutorAttempt, tutorSession } from "./testFixtures";
import { MAX_TUTOR_ATTEMPTS, type TutorRequest, type TutorSession } from "./types";

const model = vi.hoisted(() => ({ complete: vi.fn() }));
vi.mock("@/lib/cards/registry", () => ({
  isProviderAvailable: async () => true,
  resolveProvider: () => ({ kind: "ollama", modelId: "local-model", complete: model.complete }),
}));
import { POST } from "@/app/api/tutor/route";

beforeEach(async () => {
  await clearAll();
  model.complete.mockReset();
  // Exercise the client contract, route, provider boundary and real IndexedDB writes together.
  vi.stubGlobal("fetch", vi.fn(async (_url, init) => POST(new NextRequest("http://localhost/api/tutor", init))));
});
afterEach(() => vi.unstubAllGlobals());

it("saves and restores three spoken attempts, help, a failed request and a successful retry in the same session", async () => {
  let session = tutorSession({ task: tutorScenarioFor("duration-interview-v1"),
    skill: { id: "present-perfect-duration", conceptId: "present-perfect-duration", label: "Duration", originContext: "Interview" } });
  await saveTutorSession(session, 0);
  const save = async (change: Partial<TutorSession>) => {
    const next = { ...session, ...change, revision: session.revision + 1, updatedAt: session.updatedAt + 1 };
    await saveTutorSession(next, session.revision);
    session = (await getTutorSessions())[0];
  };
  const base = () => ({ provider: "ollama" as const, context: { level: session.level, minutes: session.minutes,
    explanationLanguage: session.explanationLanguage, focus: session.task.goal, evidence: session.evidence,
    targetSkill: session.skill?.label, targetConceptId: session.skill?.conceptId } });
  const call = (input: TutorRequest) => requestTutor(input, new AbortController().signal);
  const answers = ["I worked with React for five years.",
    "I have been working with React for over five years. And... ...most of the time I work on Frontend developer.",
    "I've used React for five years, and I still use it every day."];

  for (let index = 0; index < MAX_TUTOR_ATTEMPTS; index++) {
    await save({ phase: "practice", draft: answers[index], draftSpoken: true, supportUsed: index > 0 });
    const input: TutorRequest = { ...base(), action: "evaluate", task: session.task, text: session.draft };
    if (index === 1) {
      model.complete.mockRejectedValueOnce(Object.assign(new Error("timed out"), { name: "TimeoutError" }));
      await expect(call(input)).rejects.toThrow();
      expect((await getTutorSessions())[0]).toMatchObject({ phase: "practice", draft: answers[index], attempts: [expect.anything()] });
    }
    const feedback = { ...tutorAttempt().feedback, status: index === 0 ? "not_met" : index === 1 ? "needs_work" : "met",
      skill: index === 0 ? undefined : { label: "Duration", conceptId: "present-perfect-duration", evidence: "", result: "demonstrated" } };
    model.complete.mockResolvedValueOnce(JSON.stringify(feedback));
    const result = await call(input);
    expect(result.action).toBe("evaluate");
    if (result.action !== "evaluate") throw new Error("Expected feedback");
    const attempt = tutorAnswer(session, `attempt-${index}`, 2000 + index * 1000, result.feedback, result.judge);
    await save({ phase: "feedback", draft: "", draftSpoken: false,
      skill: skillFromFirstAttempt(session, attempt), attempts: [...session.attempts, attempt] });
    expect(session.attempts).toHaveLength(index + 1);
    expect(session.attempts[index]).toMatchObject({ text: answers[index], spoken: true, supportUsed: index > 0 });
    expect(session.attempts[index].feedback.status).toBe(index === 1 ? "uncertain" : feedback.status);

    if (index === 0) {
      model.complete.mockResolvedValueOnce(JSON.stringify({ answer: "Use have been working for an experience that continues now." }));
      const help = await call({ ...base(), action: "help", task: session.task, text: attempt.text, feedback: attempt.feedback, question: "Why have been?" });
      if (help.action !== "help") throw new Error("Expected help");
      await save({ supportUsed: true, help: [{ question: "Why have been?", answer: help.answer, createdAt: 2500 }] });
    }
  }
  await save({ phase: "complete", completedAt: 6000 });
  expect(session.attempts.map(a => a.text)).toEqual(answers);
  expect(await getProductionAttempts()).toHaveLength(3);
  expect(session.help).toHaveLength(1);
});

it("reports a mismatched response action instead of silently dropping it in the UI", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ action: "help", answer: "Wrong response." })));
  await expect(requestTutor({ action: "plan", provider: "ollama",
    context: { level: "B1", minutes: 5, explanationLanguage: "en", focus: "Work", evidence: [] } }, new AbortController().signal))
    .rejects.toThrow("incompleta");
});
