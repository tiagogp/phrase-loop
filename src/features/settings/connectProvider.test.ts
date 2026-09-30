import { describe, expect, it, vi } from "vitest";
import { connectProvider } from "./connectProvider";

describe("connect and select an AI", () => {
  it("checks the draft before saving it as the default", async () => {
    const order: string[] = [];
    const test = vi.fn(async () => { order.push("test"); return { ok: true, detail: "Connected" }; });
    const save = vi.fn(async () => { order.push("save"); return { ok: true }; });
    const draft = { openaiApiKey: "test-placeholder" };
    expect(await connectProvider("openai", draft, test, save)).toEqual({ ok: true });
    expect(order).toEqual(["test", "save"]);
    expect(test).toHaveBeenCalledWith("openai", draft);
    expect(save).toHaveBeenCalledWith({ ...draft, defaultProvider: "openai" });
  });

  it("keeps saved credentials and the previous default when the test fails", async () => {
    const save = vi.fn();
    const failure = { ok: false, detail: "Unavailable" };
    expect(await connectProvider("claude", { anthropicApiKey: "invalid-placeholder" }, async () => failure, save)).toBe(failure);
    expect(save).not.toHaveBeenCalled();
  });

  it("reports a save failure even when the connection test worked", async () => {
    const failure = { ok: false, error: "Storage unavailable" };
    expect(await connectProvider("ollama", { ollamaModel: "local-model" }, async () => ({ ok: true, detail: "Ready" }), async () => failure)).toBe(failure);
  });

  it("can select an already saved provider without replacing its credential", async () => {
    const save = vi.fn(async () => ({ ok: true }));
    await connectProvider("openrouter", {}, async () => ({ ok: true, detail: "Ready" }), save);
    expect(save).toHaveBeenCalledWith({ defaultProvider: "openrouter" });
  });
});
