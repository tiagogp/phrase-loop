import type { ConversationTurn } from "@/lib/cards/provider";

/** Bound history so one long session can't blow the model's context or the request timeout. */
export const MAX_CONVERSATION_TURNS = 60;
export const MAX_TURN_CHARS = 2000;

/**
 * Untrusted turn history from a request body. Keeps only the most recent turns — the tail is what
 * matters — and keeps a "travei" stretch marked so it is read as Portuguese, not as English.
 */
export function parseConversationTurns(raw: unknown, maxTurns = MAX_CONVERSATION_TURNS): ConversationTurn[] {
  if (!Array.isArray(raw)) return [];
  const out: ConversationTurn[] = [];
  for (const item of raw.slice(-maxTurns)) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const role = o.role === "assistant" ? "assistant" : o.role === "user" ? "user" : null;
    const text = typeof o.text === "string" ? o.text.trim().slice(0, MAX_TURN_CHARS) : "";
    if (!role || !text) continue;
    out.push(role === "user" && o.codeSwitch === true ? { role, text, codeSwitch: true } : { role, text });
  }
  return out;
}
