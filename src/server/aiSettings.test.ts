import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getDefaultProvider,
  getOllamaBaseUrl,
  getProviderApiKey,
  ensureProviderApiKey,
  isProviderConfigured,
  replaceRuntimeAiSettings,
} from "./aiSettings";
import { GET as getPublicSettings } from "@/app/api/settings/route";
import { GET as getCardProviders } from "@/app/api/cards/providers/route";
import { isProviderAvailable } from "@/lib/cards/registry";

describe("AI settings", () => {
  const originalAnthropic = process.env.ANTHROPIC_API_KEY;
  const originalOpenAI = process.env.OPENAI_API_KEY;
  const originalOllama = process.env.OLLAMA_BASE_URL;
  const originalSecretPort = process.env.PHRASELOOP_SECRET_PORT;
  const originalSecretToken = process.env.PHRASELOOP_SECRET_TOKEN;

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OLLAMA_BASE_URL;
    replaceRuntimeAiSettings({});
  });

  afterEach(() => {
    if (originalAnthropic === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalAnthropic;
    if (originalOpenAI === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalOpenAI;
    if (originalOllama === undefined) delete process.env.OLLAMA_BASE_URL;
    else process.env.OLLAMA_BASE_URL = originalOllama;
    if (originalSecretPort === undefined) delete process.env.PHRASELOOP_SECRET_PORT;
    else process.env.PHRASELOOP_SECRET_PORT = originalSecretPort;
    if (originalSecretToken === undefined) delete process.env.PHRASELOOP_SECRET_TOKEN;
    else process.env.PHRASELOOP_SECRET_TOKEN = originalSecretToken;
    vi.unstubAllGlobals();
  });

  it("defaults to Ollama without silently selecting cloud AI", () => {
    expect(getDefaultProvider()).toBe("ollama");
  });

  it("gives secure runtime settings precedence over environment values", () => {
    process.env.ANTHROPIC_API_KEY = "env-secret";
    process.env.OLLAMA_BASE_URL = "http://env-ollama:11434";
    replaceRuntimeAiSettings({
      defaultProvider: "claude",
      anthropicApiKey: "secure-secret",
      ollamaBaseUrl: "http://saved-ollama:11434",
    });
    expect(getDefaultProvider()).toBe("claude");
    expect(getProviderApiKey("claude")).toBe("secure-secret");
    expect(getOllamaBaseUrl()).toBe("http://saved-ollama:11434");
  });

  it("never exposes credentials in the public settings response", async () => {
    replaceRuntimeAiSettings({
      anthropicApiKey: "anthropic-private-value",
      openaiApiKey: "openai-private-value",
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const response = await getPublicSettings();
    const serialized = JSON.stringify(await response.json());
    expect(serialized).not.toContain("anthropic-private-value");
    expect(serialized).not.toContain("openai-private-value");
    expect(serialized).not.toContain("apiKey");
  });

  it("lists saved cloud providers without fetching secrets, then loads the key on use", async () => {
    process.env.PHRASELOOP_SECRET_PORT = "12345";
    process.env.PHRASELOOP_SECRET_TOKEN = "local-test-token";
    replaceRuntimeAiSettings({ configuredProviders: { claude: true } });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ secret: "saved-secret" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    expect(isProviderConfigured("claude")).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    const publicResponse = await getPublicSettings();
    const publicSettings = await publicResponse.json();
    expect(publicSettings.providers.find((provider: { kind: string }) => provider.kind === "claude").configured).toBe(true);
    const cardResponse = await getCardProviders();
    const cardProviders = await cardResponse.json();
    expect(cardProviders.providers.find((provider: { kind: string }) => provider.kind === "claude").available).toBe(true);
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes("/secret/"))).toBe(true);
    expect(await isProviderAvailable("claude")).toBe(true);
    expect(getProviderApiKey("claude")).toBe("saved-secret");
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:12345/secret/claude", {
      headers: { authorization: "Bearer local-test-token" },
      cache: "no-store",
    });
    expect(await ensureProviderApiKey("claude")).toBe("saved-secret");
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/secret/"))).toHaveLength(1);
  });
});
