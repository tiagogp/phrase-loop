/**
 * Long-session review. The whole conversation — the partner's turns and the "travei" stretches
 * included — goes to the review model, which returns strengths and at most 3 gaps, each tied to
 * the learner's real words. Gaps without proof are dropped by the shared parser; a malformed reply
 * comes back as an empty review flagged `malformed` instead of an error.
 */

import { NextRequest, NextResponse } from "next/server";
import { safeStr } from "@/lib/cards/intake";
import { isProviderAvailable, resolveProvider } from "@/lib/cards/registry";
import { modelJudge } from "@/lib/evaluation/judge";
import { MAX_CORRECTION_JSON_BYTES, PROVIDER_SINGLE_CALL_TIMEOUT_MS } from "@/lib/constants";
import { logger } from "@/lib/logger";
import { buildGapReviewPrompt, GAP_REVIEW_PROMPT_VERSION, normalizePatternLabel, parseGapReview } from "@/features/converse/gapReview";
import { isHttpError, isProviderKind, readJsonObject } from "@/server/http/validation";
import { classifyProviderFailure, failureResponse, providerFailure } from "@/server/http/providerFailure";
import { parseConversationTurns } from "@/server/http/conversationTurns";
import { getDefaultProvider } from "@/server/aiSettings";

export const runtime = "nodejs";
export const maxDuration = 120;

/** A 10-minute session stays well under this; the bound only stops a crafted body. */
const MAX_REVIEW_TURNS = 120;

function parseFunctions(raw: unknown): { id: string; label: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 12).flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const o = item as Record<string, unknown>;
    const id = safeStr(o.id, "", 80);
    const label = safeStr(o.label, "", 120);
    return id && label ? [{ id, label }] : [];
  });
}

export async function POST(req: NextRequest) {
  try {
    const obj = await readJsonObject(req, { maxBytes: MAX_CORRECTION_JSON_BYTES });
    if (!obj) return failureResponse(providerFailure("invalid_input"));
    const turns = parseConversationTurns(obj.turns, MAX_REVIEW_TURNS);
    if (!turns.some((turn) => turn.role === "user")) {
      return failureResponse(providerFailure("invalid_input", "Não há falas suas para revisar nesta sessão."));
    }
    const kind = isProviderKind(obj.provider) ? obj.provider : getDefaultProvider();
    if (!(await isProviderAvailable(kind))) return failureResponse(providerFailure("provider_not_configured"));
    const model = safeStr(obj.ollamaModel, "", 100) || undefined;
    const provider = resolveProvider(kind, { learnerLang: "pt", targetLang: "en", model });
    if (!provider.complete) {
      return failureResponse(providerFailure("provider_not_configured", "Esta IA não consegue revisar a sessão. Escolha outra IA em Configurações."));
    }
    const input = {
      turns,
      level: safeStr(obj.level, "", 8) || undefined,
      scenario: safeStr(obj.scenario, "conversation", 300),
      functions: parseFunctions(obj.functions),
      knownPatternLabels: Array.isArray(obj.knownPatternLabels)
        ? obj.knownPatternLabels.slice(0, 40).map(normalizePatternLabel).filter(Boolean)
        : [],
    };
    const raw = await provider.complete(buildGapReviewPrompt(input), { signal: req.signal, timeoutMs: PROVIDER_SINGLE_CALL_TIMEOUT_MS });
    return NextResponse.json({
      review: parseGapReview(raw, input),
      judge: modelJudge({ provider: provider.kind, model: provider.modelId, promptVersion: GAP_REVIEW_PROMPT_VERSION }),
    });
  } catch (err: unknown) {
    if (isHttpError(err)) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    const failure = classifyProviderFailure(err, { signal: req.signal });
    logger.error({ err, code: failure.code }, "Long session review error");
    return failureResponse(failure);
  }
}
