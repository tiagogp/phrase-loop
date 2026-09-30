import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { tutorAttempt, tutorSession } from "@/features/tutor/testFixtures";
import type { TutorRequest } from "@/features/tutor/types";

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
  it("uses the selected provider and validates a situational task", async () => {
    mocked.complete.mockResolvedValue(JSON.stringify(tutorSession().task));
    const response = await POST(request(input));
    expect(response.status).toBe(200);
    expect((await response.json()).task).toEqual(tutorSession().task);
    expect(mocked.resolve).toHaveBeenCalledWith("ollama", expect.objectContaining({ model: "chosen-model" }));
    expect(mocked.complete.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
  it("stamps the actual evaluation instrument, accepts uncertainty and rejects invented quotes", async () => {
    const feedback = { ...tutorAttempt().feedback, status: "uncertain" };
    mocked.complete.mockResolvedValue(JSON.stringify(feedback));
    const evaluation = { ...input, action: "evaluate", task: tutorSession().task, text: tutorAttempt().text };
    const body = await (await POST(request(evaluation))).json();
    expect(body.feedback.status).toBe("uncertain");
    expect(body.judge).toMatchObject({ by: "model", model: "resolved-model", promptVersion: "tutor-evidence-v2" });
    mocked.complete.mockResolvedValue(JSON.stringify({ ...feedback, points: [{ original: "words the learner never wrote", revised: "x", explanation: "y" }] }));
    expect((await POST(request(evaluation))).status).toBe(502);
  });
  it("requires a grounded skill diagnosis and strips invented scenario verification", async () => {
    const evaluation = { ...input, action: "evaluate", task: tutorSession().task, text: "I want change my appointment." };
    const feedback = { ...tutorAttempt().feedback, status: "partial", skill: { label: "Pedido", conceptId: "polite-requests", result: "needs_work", evidence: "I want change" }, points: [] };
    mocked.complete.mockResolvedValueOnce(JSON.stringify(feedback));
    expect((await POST(request(evaluation))).status).toBe(502);
    mocked.complete.mockResolvedValueOnce(JSON.stringify({ ...feedback, points: [{ original: "I want change", revised: "Could I change", explanation: "Make a polite request." }] }));
    expect((await POST(request(evaluation))).status).toBe(200);
    mocked.complete.mockResolvedValueOnce(JSON.stringify({ ...tutorSession().task, scenarioId: "request-meeting-v1" }));
    const body = await (await POST(request(input))).json();
    expect(body.task.scenarioId).toBeUndefined();
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
