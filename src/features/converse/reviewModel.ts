/**
 * Which AI reviews a long session. The conversation can run on a small local model while the
 * review — the part that has to find gaps with proof — goes to a larger one, local or cloud.
 * Default: the same provider and model as the conversation.
 *
 * Stored locally as a presentation-like preference (not learning history, not in the backup).
 */

import type { ProviderKind } from "@/lib/cards/provider";
import type { ProviderStatus } from "@/types/aiSettings";

const KEY = "phraseloop.longSessionReviewModel.v1";
const KINDS: readonly ProviderKind[] = ["ollama", "claude", "openai", "openrouter"];

export interface ReviewModelPreference {
  /** Absent = same as the conversation. */
  provider?: ProviderKind;
  /** Ollama only: a specific installed model. */
  model?: string;
}

export interface ReviewSelection {
  provider: ProviderKind;
  model?: string;
  /** True when the review uses the conversation's own provider and model. */
  sameAsConversation: boolean;
  /** The chosen provider is unavailable right now, so the conversation's is used instead. */
  fellBack: boolean;
  isLocal: boolean;
  label: string;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function normalizeReviewPreference(raw: unknown): ReviewModelPreference {
  if (typeof raw !== "object" || raw === null) return {};
  const o = raw as Record<string, unknown>;
  const provider = KINDS.includes(o.provider as ProviderKind) ? (o.provider as ProviderKind) : undefined;
  const model = provider === "ollama" && typeof o.model === "string" && o.model.trim() ? o.model.trim().slice(0, 100) : undefined;
  return provider ? { provider, ...(model ? { model } : {}) } : {};
}

export function getReviewModelPreference(): ReviewModelPreference {
  try {
    const raw = storage()?.getItem(KEY);
    return raw ? normalizeReviewPreference(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

export function saveReviewModelPreference(preference: ReviewModelPreference): ReviewModelPreference {
  const next = normalizeReviewPreference(preference);
  try {
    storage()?.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: the default (same as conversation) still applies */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("phraseloop:review-model-updated"));
  return next;
}

export function subscribeToReviewModel(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("phraseloop:review-model-updated", onChange);
  return () => window.removeEventListener("phraseloop:review-model-updated", onChange);
}

/**
 * Resolve the reviewer for a session. An explicit choice wins while it is available; otherwise the
 * conversation's provider and model are used, flagged so the screen can say so.
 */
export function resolveReviewSelection(
  preference: ReviewModelPreference,
  conversation: { provider: ProviderKind; model?: string },
  providers: ProviderStatus[],
  ollamaModels: string[] = [],
): ReviewSelection {
  const status = (kind: ProviderKind) => providers.find((item) => item.kind === kind);
  const chosen = preference.provider ? status(preference.provider) : undefined;
  const modelOk = preference.provider !== "ollama" || !preference.model || ollamaModels.includes(preference.model);
  if (preference.provider && chosen?.available && modelOk) {
    const model = preference.provider === "ollama" ? preference.model ?? (conversation.provider === "ollama" ? conversation.model : undefined) : undefined;
    return {
      provider: preference.provider,
      model,
      sameAsConversation: preference.provider === conversation.provider && (preference.provider !== "ollama" || model === conversation.model),
      fellBack: false,
      isLocal: chosen.isLocal,
      label: chosen.label + (model ? ` · ${model}` : ""),
    };
  }
  const own = status(conversation.provider);
  return {
    provider: conversation.provider,
    model: conversation.model,
    sameAsConversation: true,
    fellBack: Boolean(preference.provider),
    isLocal: own?.isLocal ?? false,
    label: (own?.label ?? conversation.provider) + (conversation.provider === "ollama" && conversation.model ? ` · ${conversation.model}` : ""),
  };
}
