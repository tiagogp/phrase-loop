import type { ProviderKind } from "@/lib/cards/provider";

export const AI_SETUP_STEPS = ["Choose your AI", "Paste a key or detect Ollama", "Test and start"] as const;
export function aiSetupStep(input: { selected: boolean; ready: boolean; connected: boolean }): 1 | 2 | 3 {
  return !input.selected ? 1 : input.ready || input.connected ? 3 : 2;
}
export function connectionNextStep(provider: ProviderKind): string {
  return provider === "ollama"
    ? "We couldn’t connect yet. Open Ollama, download a model and detect it again. You can continue without AI."
    : "We couldn’t connect yet. Check that you pasted an API key from the selected provider and that your account has access. Try again, or continue without AI.";
}
