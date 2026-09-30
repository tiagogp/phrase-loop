import "server-only";

import type { ProviderKind } from "@/lib/cards/provider";
import type { SecureAiSettings } from "@/types/aiSettings";

const DEFAULT_OLLAMA_URL = "http://localhost:11434";

type RuntimeStore = {
  settings: SecureAiSettings;
  version: number;
};

const globalStore = globalThis as typeof globalThis & {
  __phraseLoopAiSettings?: RuntimeStore;
};

function store(): RuntimeStore {
  globalStore.__phraseLoopAiSettings ??= { settings: {}, version: 0 };
  return globalStore.__phraseLoopAiSettings;
}

export function replaceRuntimeAiSettings(settings: SecureAiSettings): void {
  const s = store();
  s.settings = { ...settings };
  s.version += 1;
}

export function getRuntimeAiSettings(): SecureAiSettings {
  return { ...store().settings };
}

export function getSettingsVersion(): number {
  return store().version;
}

export function getDefaultProvider(): ProviderKind {
  return store().settings.defaultProvider ?? "ollama";
}

export function getOllamaBaseUrl(): string {
  return (
    store().settings.ollamaBaseUrl ||
    process.env.OLLAMA_BASE_URL ||
    DEFAULT_OLLAMA_URL
  );
}

export function getOllamaModel(): string | undefined {
  return store().settings.ollamaModel || process.env.OLLAMA_MODEL || undefined;
}

export function getProviderApiKey(kind: "claude" | "openai" | "openrouter"): string | undefined {
  if (kind === "claude") {
    return store().settings.anthropicApiKey || process.env.ANTHROPIC_API_KEY || undefined;
  }
  if (kind === "openrouter") {
    return store().settings.openrouterApiKey || process.env.OPENROUTER_API_KEY || undefined;
  }
  return store().settings.openaiApiKey || process.env.OPENAI_API_KEY || undefined;
}

const keyFields = {
  claude: "anthropicApiKey",
  openai: "openaiApiKey",
  openrouter: "openrouterApiKey",
} as const;

/** Checking the UI status must never fetch saved API keys. */
export function isProviderConfigured(kind: "claude" | "openai" | "openrouter"): boolean {
  return Boolean(store().settings.configuredProviders?.[kind] || getProviderApiKey(kind));
}

/** Fetch a saved key only for an actual cloud request or connection test. */
export async function ensureProviderApiKey(kind: "claude" | "openai" | "openrouter"): Promise<string | undefined> {
  const s = store().settings;
  if (s[keyFields[kind]]) return s[keyFields[kind]];
  if (s.configuredProviders?.[kind]) {
    const port = process.env.PHRASELOOP_SECRET_PORT;
    const token = process.env.PHRASELOOP_SECRET_TOKEN;
    if (port && token && /^\d+$/.test(port)) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/secret/${kind}`, {
          headers: { authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (response.ok) {
          const result = await response.json() as { secret?: unknown };
          if (typeof result.secret === "string" && result.secret) {
            s[keyFields[kind]] = result.secret;
            return result.secret;
          }
        }
      } catch {
        // An unavailable desktop secret service leaves environment credentials usable.
      }
    }
  }
  return getProviderApiKey(kind);
}

export function isInternalSettingsRequest(req: Request): boolean {
  const expected = process.env.PHRASELOOP_SETTINGS_TOKEN;
  return Boolean(expected) && req.headers.get("x-phraseloop-settings-token") === expected;
}

export function isAuthorizedSettingsRequest(req: Request): boolean {
  const expected = process.env.PHRASELOOP_SETTINGS_TOKEN;
  if (!expected) return false;
  if (req.headers.get("x-phraseloop-settings-token") === expected) return true;
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = /(?:^|;\s*)pl-settings-token=([^;]*)/.exec(cookieHeader);
  return !!match && decodeURIComponent(match[1]) === expected;
}
