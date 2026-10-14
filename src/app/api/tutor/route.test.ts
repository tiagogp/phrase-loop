import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { tutorAttempt, tutorSession } from "@/features/tutor/testFixtures";
import type { TutorRequest } from "@/features/tutor/types";
import { isTutorSession } from "@/features/tutor/contract";
import { skillFromFirstAttempt, tutorSkillEvidence } from "@/features/tutor/learning";

const mocked = vi.hoisted(() => ({ available: vi.fn(), complete: vi.fn(), resolve: vi.fn() }));
vi.mock("@/lib/cards/registry", () => ({ isProviderAvailable: mocked.available, resolveProvider: mocked.resolve }));
import { POST } from "./route";
const input: TutorRequest = { action: "plan", provider: "ollama", ollamaModel: "chosen-model", context: { level: "A2", minutes: 5, explanationLanguage: "pt", focus: "Remarcar", evidence: [] } };
const request = (body: unknown) => new NextRequest("http://localhost/api/tutor", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
beforeEach(() => {
  vi.resetAllMocks();
  mocked.available.mockResolvedValue(true);
  mocked.resolve.mockReturnValue({ kind: "ollama", modelId: "resolved-model", complete: mocked.complete });
});

describe("tutor API", () => {
  it.each(["ollama", "openai", "claude", "openrouter"])("keeps retry feedback with an unknown task verdict uncertain for %s", async provider => {
    const feedback = { ...tutorAttempt().feedback, status: "needs_work" };
    mocked.complete.mockResolvedValueOnce(JSON.stringify(feedback));
    const response = await POST(request({ ...input, provider, action: "evaluate", task: tutorSession().task, text: tutorAttempt().text,
      context: { ...input.context, targetConceptId: "polite-requests" } }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.feedback).toEqual({ ...feedback, status: "uncertain", skill: { ...feedback.skill, label: "Fazer pedidos com educação" } });
    const skill = { id: "polite-requests", conceptId: "polite-requests", label: "Requests", originContext: "Work" };
    expect(tutorSkillEvidence([tutorSession({ skill, attempts: [tutorAttempt({ feedback: body.feedback })] })], skill))
      .toMatchObject({ initialDifficulty: false, independent: 0, assisted: 0, transfers: 0 });
    const schema = mocked.complete.mock.calls[0][1].responseSchema.schema;
    expect(schema.properties.status.enum).toEqual(["met", "partial", "not_met", "uncertain"]);
    expect(schema.properties.skill.properties.conceptId.enum).toEqual(["polite-requests"]);
  });
  it.each([undefined, "", null, 42])("does not invent a task verdict for missing or malformed status %s", async status => {
    mocked.complete.mockResolvedValueOnce(JSON.stringify({ ...tutorAttempt().feedback, status }));
    expect((await POST(request({ ...input, action: "evaluate", task: tutorSession().task, text: tutorAttempt().text }))).status).toBe(502);
  });
  it.each([undefined, null])("keeps usable feedback when the model omits the skill assessment (%s)", async skill => {
    const feedback = { ...tutorAttempt().feedback, skill };
    mocked.complete.mockResolvedValueOnce(JSON.stringify(feedback));
    const response = await POST(request({ ...input, action: "evaluate", task: tutorSession().task, text: tutorAttempt().text }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.feedback).toEqual({ ...feedback, skill: undefined });
    const attempt = tutorAttempt({ feedback: body.feedback, judge: body.judge });
    expect(skillFromFirstAttempt(tutorSession(), attempt)).toBeUndefined();
    expect(isTutorSession(tutorSession({ phase: "feedback", attempts: [attempt] }))).toBe(true);
    expect(mocked.complete).toHaveBeenCalledTimes(1);
  });
  it.each(["met", "not_met"])("preserves the follow-up target without inventing a skill verdict when task status is %s", async status => {
    mocked.complete.mockResolvedValueOnce(JSON.stringify({ ...tutorAttempt().feedback, status, skill: undefined }));
    const response = await POST(request({ ...input, action: "evaluate", task: tutorSession().task, text: tutorAttempt().text,
      context: { ...input.context, targetConceptId: "present-perfect-duration" } }));
    expect(response.status).toBe(200);
    const { feedback } = await response.json();
    expect(feedback.skill).toMatchObject({ conceptId: "present-perfect-duration", result: "uncertain", evidence: "" });
    const skill = { id: "present-perfect-duration", conceptId: "present-perfect-duration", label: "Duration", originContext: "Work" };
    const session = tutorSession({ skill, attempts: [tutorAttempt({ feedback })] });
    expect(tutorSkillEvidence([session], skill)).toMatchObject({ initialDifficulty: false, independent: 0, assisted: 0, transfers: 0 });
  });
  it("still rejects incomplete feedback and malformed skill assessments", async () => {
    const evaluation = { ...input, action: "evaluate", task: tutorSession().task, text: tutorAttempt().text };
    for (const feedback of [
      { ...tutorAttempt().feedback, skill: undefined, example: undefined },
      { ...tutorAttempt().feedback, skill: { result: "made_up" } },
      { ...tutorAttempt().feedback, skill: undefined, feedback: "x".repeat(2401) },
    ]) {
      mocked.complete.mockResolvedValueOnce(JSON.stringify(feedback));
      expect((await POST(request(evaluation))).status).toBe(502);
    }
  });
  it("accepts a local model's longer explanation without losing feedback or preventing session restore", async () => {
    const feedback = { ...tutorAttempt().feedback,
      feedback: "Explain how long you have used this technology. ".repeat(26), skill: undefined, points: undefined };
    expect(feedback.feedback.length).toBeGreaterThan(1200);
    mocked.complete.mockResolvedValueOnce(JSON.stringify(feedback));
    const response = await POST(request({ ...input, action: "evaluate", task: tutorSession().task, text: tutorAttempt().text }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.feedback.feedback).toBe(feedback.feedback);
    expect(body.feedback.points).toEqual([]);
    expect(isTutorSession(tutorSession({ phase: "feedback", attempts: [tutorAttempt({ feedback: body.feedback, judge: body.judge })] }))).toBe(true);
  });
  it("uses the selected provider and validates a situational task", async () => {
    mocked.complete.mockResolvedValue(JSON.stringify(tutorSession().task));
    const response = await POST(request(input));
    expect(response.status).toBe(200);
    expect((await response.json()).task).toEqual(tutorSession().task);
    expect(mocked.resolve).toHaveBeenCalledWith("ollama", expect.objectContaining({ model: "chosen-model" }));
    expect(mocked.complete.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
  it("stamps the actual evaluation instrument, accepts uncertainty and drops invented quotes", async () => {
    const feedback = { ...tutorAttempt().feedback, status: "uncertain" };
    mocked.complete.mockResolvedValue(JSON.stringify(feedback));
    const evaluation = { ...input, action: "evaluate", task: tutorSession().task, text: tutorAttempt().text };
    const body = await (await POST(request(evaluation))).json();
    expect(body.feedback.status).toBe("uncertain");
    expect(body.judge).toMatchObject({ by: "model", model: "resolved-model", promptVersion: "tutor-evidence-v2" });
    mocked.complete.mockResolvedValue(JSON.stringify({ ...feedback, points: [{ original: "words the learner never wrote", revised: "x", explanation: "y" }] }));
    const dropped = await POST(request(evaluation));
    expect(dropped.status).toBe(200);
    expect((await dropped.json()).feedback.points).toEqual([]);
  });
  it("records an ungrounded needs_work diagnosis as uncertain and strips invented scenario verification", async () => {
    const evaluation = { ...input, action: "evaluate", task: tutorSession().task, text: "I want change my appointment." };
    const feedback = { ...tutorAttempt().feedback, status: "partial", skill: { label: "Pedido", conceptId: "polite-requests", result: "needs_work", evidence: "I want change" }, points: [] };
    mocked.complete.mockResolvedValueOnce(JSON.stringify(feedback));
    const ungrounded = await POST(request(evaluation));
    expect(ungrounded.status).toBe(200);
    expect((await ungrounded.json()).feedback.skill).toMatchObject({ result: "uncertain", evidence: "" });
    mocked.complete.mockResolvedValueOnce(JSON.stringify({ ...feedback, points: [{ original: "I want change", revised: "Could I change", explanation: "Make a polite request." }] }));
    const grounded = await POST(request(evaluation));
    expect((await grounded.json()).feedback.skill).toMatchObject({ result: "needs_work", evidence: "I want change" });
    mocked.complete.mockResolvedValueOnce(JSON.stringify({ ...tutorSession().task, scenarioId: "request-meeting-v1" }));
    const body = await (await POST(request(input))).json();
    expect(body.task.scenarioId).toBeUndefined();
  });
  it("accepts a spoken answer quoted with added capitals and punctuation, mapping quotes back to the transcript", async () => {
    const text = "hi john i want change my appointment please";
    const evaluation = { ...input, action: "evaluate", task: tutorSession().task, text };
    mocked.complete.mockResolvedValueOnce(JSON.stringify({ ...tutorAttempt().feedback, status: "partial", retryInstruction: " ",
      skill: { label: "Pedido", conceptId: "polite-requests", result: "needs_work", evidence: "I want change." },
      points: [{ original: "Hi John, I want change", revised: "Hi John, could I change", explanation: "Make a polite request." }] }));
    const response = await POST(request(evaluation));
    expect(response.status).toBe(200);
    const { feedback } = await response.json();
    expect(feedback.points[0].original).toBe("hi john i want change");
    expect(feedback.skill.evidence).toBe("i want change");
    expect(feedback.retryInstruction.trim()).not.toBe("");
  });
  it("answers a question without manufacturing or changing any score", async () => {
    mocked.complete.mockResolvedValue(JSON.stringify({ answer: "Use to before the action here." }));
    const response = await POST(request({ ...input, action: "help", task: tutorSession().task, text: "", question: "Why to?" }));
    expect(await response.json()).toEqual({ action: "help", answer: "Use to before the action here." });
  });
  it("rejects a follow-up that repeats the exact old situation", async () => {
    mocked.complete.mockResolvedValue(JSON.stringify(tutorSession().task));
    const response = await POST(request({ ...input, context: { ...input.context, previousTask: tutorSession().task } }));
    expect(response.status).toBe(502);
  });
  it("requires the same canonical concept when evaluating a follow-up", async () => {
    const evaluation = { ...input, action: "evaluate", task: tutorSession().task, text: tutorAttempt().text,
      context: { ...input.context, targetSkill: "Present perfect para duração", targetConceptId: "present-perfect-duration" } };
    mocked.complete.mockResolvedValueOnce(JSON.stringify(tutorAttempt().feedback));
    expect((await POST(request(evaluation))).status).toBe(502);
    mocked.complete.mockResolvedValueOnce(JSON.stringify({ ...tutorAttempt().feedback,
      skill: { label: "Outra descrição da mesma habilidade", conceptId: "present-perfect-duration", evidence: "", result: "demonstrated" } }));
    expect((await POST(request(evaluation))).status).toBe(200);
  });
  it("keeps the skill name out of the follow-up prompt shown to the learner", async () => {
    mocked.complete.mockResolvedValue(JSON.stringify({ ...tutorSession().task, situation: "Nova reunião de trabalho", instruction: "Use Present perfect para duração para explicar o trabalho remoto." }));
    const response = await POST(request({ ...input, context: { ...input.context, targetSkill: "Present perfect para duração", previousTask: tutorSession().task } }));
    expect(response.status).toBe(502);
  });
  it("rejects oversized or unsupported requests before calling any provider", async () => {
    expect((await POST(request({ ...input, provider: "unknown" }))).status).toBe(400);
    expect((await POST(request({ ...input, padding: "x".repeat(64_000) }))).status).toBe(413);
    expect(mocked.complete).not.toHaveBeenCalled();
  });
  it("returns recoverable errors for unavailable, malformed, timed-out and cancelled requests", async () => {
    mocked.available.mockResolvedValueOnce(false);
    expect((await (await POST(request(input))).json()).code).toBe("provider_not_configured");
    mocked.complete.mockResolvedValueOnce("this is not a task");
    expect((await (await POST(request(input))).json()).code).toBe("provider_failed");
    mocked.complete.mockRejectedValueOnce(Object.assign(new Error("timed out"), { name: "TimeoutError" }));
    expect((await POST(request(input))).status).toBe(504);
    const controller = new AbortController(); controller.abort();
    mocked.complete.mockRejectedValueOnce(Object.assign(new Error("cancelled"), { name: "AbortError" }));
    const aborted = new NextRequest("http://localhost/api/tutor", { method: "POST", body: JSON.stringify(input), signal: controller.signal });
    expect((await POST(aborted)).status).toBe(499);
  });
});
