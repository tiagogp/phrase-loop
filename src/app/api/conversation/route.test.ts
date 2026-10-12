import { beforeEach, describe, expect, it, vi } from "vitest";

const converse = vi.fn(async () => "So you'd rather push the release back a week?");

vi.mock("@/lib/cards/registry", () => ({
  isProviderAvailable: vi.fn(async () => true),
  resolveProvider: vi.fn(() => ({ kind: "ollama", label: "Ollama", isLocal: true, converse })),
}));

function request(body: unknown) {
  return new Request("http://localhost/api/conversation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/conversation long session", () => {
  beforeEach(() => converse.mockClear());

  it("keeps a travei turn marked and hands its Portuguese to the next reply", async () => {
    const { POST } = await import("./route");
    const response = await POST(request({
      provider: "ollama",
      scenario: "Estimate a deadline with uncertainty",
      level: "B1",
      history: [
        { role: "assistant", text: "When can it ship?" },
        { role: "user", text: "eu não sei, depende do review", codeSwitch: true },
      ],
      longSession: { codeSwitch: "eu não sei, depende do review", functions: ["estimate with uncertainty"], newExpressionBudget: 9 },
    }) as never);

    expect(response.status).toBe(200);
    const [history, options] = converse.mock.calls[0] as unknown as [unknown[], { longSession: Record<string, unknown> }];
    expect(history[1]).toEqual({ role: "user", text: "eu não sei, depende do review", codeSwitch: true });
    expect(options.longSession).toMatchObject({
      codeSwitch: "eu não sei, depende do review",
      functions: ["estimate with uncertainty"],
      newExpressionBudget: 2,
    });
  });

  it("leaves ordinary conversations without long-session options", async () => {
    const { POST } = await import("./route");
    await POST(request({ provider: "ollama", scenario: "Small talk", history: [{ role: "user", text: "Hi", codeSwitch: "yes" }] }) as never);
    const [history, options] = converse.mock.calls[0] as unknown as [unknown[], { longSession?: unknown }];
    expect(history[0]).toEqual({ role: "user", text: "Hi" });
    expect(options.longSession).toBeUndefined();
  });
});
