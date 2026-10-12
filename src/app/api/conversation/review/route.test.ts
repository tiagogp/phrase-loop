import { beforeEach, describe, expect, it, vi } from "vitest";

const complete = vi.fn<(prompt: string) => Promise<string>>();

vi.mock("@/lib/cards/registry", () => ({
  isProviderAvailable: vi.fn(async () => true),
  resolveProvider: vi.fn(() => ({ kind: "ollama", label: "Ollama", isLocal: true, modelId: "qwen", complete })),
}));

const turns = [
  { role: "assistant", text: "Can we ship the migration on Friday?" },
  { role: "user", text: "a gente precisa de mais tempo", codeSwitch: true },
  { role: "user", text: "We need more time." },
];

function request(body: unknown) {
  return new Request("http://localhost/api/conversation/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/conversation/review", () => {
  beforeEach(() => complete.mockReset());

  it("reviews the whole conversation and keeps only gaps with real words", async () => {
    complete.mockResolvedValueOnce(JSON.stringify({
      strengths: ["Você respondeu à pergunta."],
      gaps: [
        { kind: "code_switch", evidence: "a gente precisa de mais tempo", intent: "pedir mais prazo", natural: { casual: "We'll need a bit more time", neutral: "We need more time to do this properly" }, why: "Mais natural.", patternLabel: "ask-for-more-time", severity: "high" },
        { kind: "error", evidence: "We must to delay", intent: "x", natural: "We have to delay it", patternLabel: "modal-to", severity: "high" },
      ],
    }));
    const { POST } = await import("./route");
    const response = await POST(request({ provider: "ollama", turns, level: "B1", scenario: "Say no to the PM", knownPatternLabels: ["Ask For More Time"] }) as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(complete.mock.calls[0][0]).toContain("1. Partner: Can we ship the migration on Friday?");
    expect(complete.mock.calls[0][0]).toContain("Learner (stuck, said in Portuguese): a gente precisa de mais tempo");
    expect(complete.mock.calls[0][0]).toContain("ask-for-more-time");
    expect(data.review.gaps).toHaveLength(1);
    expect(data.review.gaps[0].patternLabel).toBe("ask-for-more-time");
    expect(data.judge).toMatchObject({ by: "model", provider: "ollama", model: "qwen", promptVersion: "long-session-gaps-v1" });
  });

  it("answers a malformed model reply with an empty review instead of an error", async () => {
    complete.mockResolvedValueOnce("Sorry, here are my thoughts in prose.");
    const { POST } = await import("./route");
    const response = await POST(request({ provider: "ollama", turns }) as never);
    expect(response.status).toBe(200);
    expect((await response.json()).review).toEqual({ strengths: [], gaps: [], malformed: true });
  });

  it("refuses a session without learner turns before calling the model", async () => {
    const { POST } = await import("./route");
    const response = await POST(request({ provider: "ollama", turns: [turns[0]] }) as never);
    expect(response.status).toBe(400);
    expect(complete).not.toHaveBeenCalled();
  });
});
