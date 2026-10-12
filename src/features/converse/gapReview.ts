/**
 * Long-session review: the whole conversation (the partner's turns and the "travei" stretches
 * included) goes to the review model, which returns at most 3 gaps — things the learner could not
 * yet say — each tied to the learner's real words. A gap without real words is discarded: a
 * weakness label without a real sentence is never shown.
 *
 * Shared by the review route and the local model-comparison script, so both judge the same way.
 * Parsing never throws: a malformed reply yields an empty review rather than a broken screen.
 */

import type { ConversationTurn } from "@/lib/cards/provider";
import { extractJsonObject } from "@/features/plan/contract";

export const GAP_REVIEW_PROMPT_VERSION = "long-session-gaps-v1";
export const MAX_GAPS = 3;
const MAX_STRENGTHS = 2;

export const GAP_KINDS = ["code_switch", "avoidance", "unnatural", "error"] as const;
export type GapKind = (typeof GAP_KINDS)[number];
export const GAP_SEVERITIES = ["high", "medium", "low"] as const;
export type GapSeverity = (typeof GAP_SEVERITIES)[number];

/** One gap as the review found it, before it is stored and tracked across sessions. */
export interface ReviewedGap {
  kind: GapKind;
  /** The learner's real words: their Portuguese, or the way around they took in English. */
  evidence: string;
  /** Avoidance only: the partner's question that asked for what was avoided. */
  askedIn?: string;
  intent: string;
  /**
   * `key` is the 2–5 word core both versions share (e.g. "push back the release"): whole
   * sentences are rarely repeated word for word, so later use is detected on this core.
   */
  natural: { casual: string; neutral: string; key?: string };
  why: string;
  functionId?: string;
  patternLabel: string;
  severity: GapSeverity;
}

export interface GapReview {
  strengths: string[];
  gaps: ReviewedGap[];
  /** The reply could not be read as the expected JSON; the review is empty, not broken. */
  malformed?: boolean;
}

export interface GapReviewInput {
  turns: ConversationTurn[];
  level?: string;
  scenario: string;
  /** Functions of the scenario's domain profile; a gap may point to one of them. */
  functions?: { id: string; label: string }[];
  /** Pattern labels of gaps already opened in earlier sessions, reused for recurrence. */
  knownPatternLabels?: string[];
}

/** B1/B2 read the "why" in Portuguese; C1+ in English. */
export function gapExplanationLanguage(level?: string): "pt" | "en" {
  const cefr = level?.trim().toUpperCase();
  return cefr === "C1" || cefr === "C2" ? "en" : "pt";
}

function transcript(turns: ConversationTurn[]): string {
  return turns
    .map((turn, index) => {
      const speaker = turn.role === "assistant" ? "Partner" : turn.codeSwitch ? "Learner (stuck, said in Portuguese)" : "Learner";
      return `${index + 1}. ${speaker}: ${turn.text.replace(/\*\*/g, "")}`;
    })
    .join("\n");
}

export function buildGapReviewPrompt(input: GapReviewInput): string {
  const language = gapExplanationLanguage(input.level) === "pt" ? "Brazilian Portuguese" : "English";
  const functions = input.functions ?? [];
  const labels = (input.knownPatternLabels ?? []).slice(0, 40);
  return [
    `You review a speaking practice between an AI partner and a ${input.level ?? "B1"} learner of English whose first language is Portuguese.`,
    `Scenario: "${input.scenario}". The learner talked for several minutes on purpose, to run into what they cannot yet say.`,
    `Find at most ${MAX_GAPS} gaps. A gap is a moment where the learner:`,
    `- "code_switch": got stuck and said it in Portuguese;`,
    `- "avoidance": went around what the partner's question asked for (simplified, stayed vague, changed the subject);`,
    `- "unnatural": was understandable but not how a professional would say it;`,
    `- "error": made a mistake that matters for the message.`,
    `Rules:`,
    `- evidence: copy the learner's exact words from the transcript (their Portuguese for code_switch). If you cannot copy real words, do not report the gap.`,
    `- askedIn: for avoidance only, copy the partner's exact question that asked for it; otherwise null.`,
    `- intent: what the learner wanted to say, in plain words.`,
    `- natural: how a professional would naturally say it, in English only, as {"casual": ..., "neutral": ..., "key": ...}. key is the 2 to 5 word core of the natural form, the part the learner would need to reuse.`,
    `- why: one short sentence in ${language} on what makes the natural version work.`,
    functions.length > 0
      ? `- functionId: the id of the function this gap belongs to, or null. Functions: ${functions.map((item) => `${item.id} (${item.label})`).join("; ")}.`
      : `- functionId: null.`,
    `- patternLabel: a short, stable kebab-case label for the underlying pattern, e.g. soften-disagreement or estimate-with-uncertainty.${labels.length > 0 ? ` Reuse one of these existing labels when it is the same pattern: ${labels.join(", ")}.` : ""}`,
    `- severity: "high" when it blocked the message, "medium" when it weakened it, "low" for polish.`,
    `- Prefer gaps the learner will meet again over one-off slips. Never invent anything that is not in the transcript. Do not correct the partner.`,
    `- strengths: up to ${MAX_STRENGTHS} short things the learner did well, in ${language}, naming what they actually did.`,
    `Return only JSON, no prose: {"strengths": [string], "gaps": [{"kind": string, "evidence": string, "askedIn": string|null, "intent": string, "natural": {"casual": string, "neutral": string, "key": string}, "why": string, "functionId": string|null, "patternLabel": string, "severity": string}]}`,
    ``,
    `Transcript:`,
    transcript(input.turns),
  ].join("\n");
}

/* ─────────────────────────── parsing ─────────────────────────── */

function text(value: unknown, max = 400): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/** Compare quotes the way a reader would: case, spacing, curly quotes and edge punctuation aside. */
export function normalizeQuote(value: string): string {
  return value
    .toLowerCase()
    .replace(/[“”"‘’'`*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\s.,;:!?…-]+|[\s.,;:!?…-]+$/g, "");
}

function quotedIn(evidence: string, turns: ConversationTurn[]): boolean {
  const needle = normalizeQuote(evidence);
  return needle.length > 0 && turns.some((turn) => normalizeQuote(turn.text).includes(needle));
}

export function normalizePatternLabel(value: unknown): string {
  return text(value, 80)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function parseNatural(raw: unknown): ReviewedGap["natural"] | null {
  if (typeof raw === "string") {
    const value = text(raw, 300);
    return value ? { casual: value, neutral: value } : null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const casual = text(o.casual, 300);
  const neutral = text(o.neutral, 300);
  if (!casual && !neutral) return null;
  const key = text(o.key, 80);
  // A "core" longer than a short phrase is just the sentence again; detection falls back to it.
  return { casual: casual || neutral, neutral: neutral || casual, ...(key && key.split(" ").length <= 7 ? { key } : {}) };
}

/** One raw gap → a gap with proof, or null. */
function parseGap(raw: unknown, input: GapReviewInput): ReviewedGap | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const learnerTurns = input.turns.filter((turn) => turn.role === "user");
  const evidence = text(o.evidence);
  if (!evidence || !quotedIn(evidence, learnerTurns)) return null;
  const fromCodeSwitch = quotedIn(evidence, learnerTurns.filter((turn) => turn.codeSwitch));
  const kind: GapKind = GAP_KINDS.includes(o.kind as GapKind) ? (o.kind as GapKind) : fromCodeSwitch ? "code_switch" : "unnatural";
  const askedIn = text(o.askedIn);
  // Avoidance is only a gap with both halves of the proof: what was asked and what came back.
  if (kind === "avoidance" && (!askedIn || !quotedIn(askedIn, input.turns.filter((turn) => turn.role === "assistant")))) return null;
  const natural = parseNatural(o.natural);
  if (!natural) return null;
  const intent = text(o.intent) || (kind === "code_switch" ? evidence : "");
  if (!intent) return null;
  const functionId = text(o.functionId, 80);
  return {
    kind,
    evidence,
    ...(kind === "avoidance" ? { askedIn } : {}),
    intent,
    natural,
    why: text(o.why, 300),
    ...(functionId && (input.functions ?? []).some((item) => item.id === functionId) ? { functionId } : {}),
    patternLabel: normalizePatternLabel(o.patternLabel) || normalizePatternLabel(natural.neutral.split(" ").slice(0, 4).join(" ")),
    severity: GAP_SEVERITIES.includes(o.severity as GapSeverity) ? (o.severity as GapSeverity) : "medium",
  };
}

const SEVERITY_RANK: Record<GapSeverity, number> = { high: 0, medium: 1, low: 2 };

/** Order of choice: recurring pattern → tied to a profile function → severity. Keeps at most 3. */
export function rankGaps(gaps: ReviewedGap[], knownPatternLabels: string[] = []): ReviewedGap[] {
  const known = new Set(knownPatternLabels);
  return gaps
    .map((gap, index) => ({ gap, index }))
    .sort((a, b) =>
      Number(known.has(b.gap.patternLabel)) - Number(known.has(a.gap.patternLabel))
      || Number(Boolean(b.gap.functionId)) - Number(Boolean(a.gap.functionId))
      || SEVERITY_RANK[a.gap.severity] - SEVERITY_RANK[b.gap.severity]
      || a.index - b.index)
    .map(({ gap }) => gap)
    .slice(0, MAX_GAPS);
}

/** Tolerant: a reply that is not the expected JSON becomes an empty review flagged `malformed`. */
export function parseGapReview(raw: unknown, input: GapReviewInput): GapReview {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = raw.length <= 30_000 ? extractJsonObject(raw) : null;
    } catch {
      value = null;
    }
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { strengths: [], gaps: [], malformed: true };
  const o = value as Record<string, unknown>;
  const strengths = Array.isArray(o.strengths) ? o.strengths.map((item) => text(item, 240)).filter(Boolean).slice(0, MAX_STRENGTHS) : [];
  const seen = new Set<string>();
  const gaps = (Array.isArray(o.gaps) ? o.gaps : [])
    .map((item) => parseGap(item, input))
    .filter((gap): gap is ReviewedGap => {
      if (!gap) return false;
      const key = `${gap.patternLabel}\n${normalizeQuote(gap.evidence)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return { strengths, gaps: rankGaps(gaps, input.knownPatternLabels), ...(Array.isArray(o.gaps) ? {} : { malformed: true }) };
}
