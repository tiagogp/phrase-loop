import { describe, expect, it } from "vitest";
import type { ProviderStatus } from "@/types/aiSettings";
import { normalizeReviewPreference, resolveReviewSelection } from "./reviewModel";

const status = (kind: ProviderStatus["kind"], available: boolean, isLocal: boolean): ProviderStatus => ({
  kind, label: kind === "ollama" ? "Ollama" : kind === "claude" ? "Claude" : kind, available, isLocal, configured: available, state: available ? "connected" : "not_configured",
});
const providers = [status("ollama", true, true), status("claude", true, false), status("openai", false, false)];
const conversation = { provider: "ollama" as const, model: "qwen3.5:9b" };

describe("review model selection", () => {
  it("defaults to the same provider and model as the conversation", () => {
    expect(resolveReviewSelection({}, conversation, providers, ["qwen3.5:9b"])).toEqual({
      provider: "ollama", model: "qwen3.5:9b", sameAsConversation: true, fellBack: false, isLocal: true, label: "Ollama · qwen3.5:9b",
    });
  });

  it("uses a larger local model for the review when chosen", () => {
    const selection = resolveReviewSelection({ provider: "ollama", model: "gemma4:27b" }, conversation, providers, ["qwen3.5:9b", "gemma4:27b"]);
    expect(selection).toMatchObject({ provider: "ollama", model: "gemma4:27b", sameAsConversation: false, isLocal: true });
  });

  it("marks a cloud reviewer so the screen can say the conversation leaves the device", () => {
    expect(resolveReviewSelection({ provider: "claude" }, conversation, providers)).toMatchObject({ provider: "claude", model: undefined, isLocal: false, sameAsConversation: false });
  });

  it("falls back to the conversation's provider when the chosen one is unavailable", () => {
    expect(resolveReviewSelection({ provider: "openai" }, conversation, providers, ["qwen3.5:9b"])).toMatchObject({ provider: "ollama", fellBack: true, sameAsConversation: true });
    expect(resolveReviewSelection({ provider: "ollama", model: "removed" }, conversation, providers, ["qwen3.5:9b"])).toMatchObject({ model: "qwen3.5:9b", fellBack: true });
  });

  it("stores only known providers, and a model only for Ollama", () => {
    expect(normalizeReviewPreference({ provider: "claude", model: "x" })).toEqual({ provider: "claude" });
    expect(normalizeReviewPreference({ provider: "mystery" })).toEqual({});
    expect(normalizeReviewPreference(null)).toEqual({});
  });
});
