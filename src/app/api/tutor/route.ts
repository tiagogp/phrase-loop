import { NextRequest, NextResponse } from "next/server";
import { isProviderAvailable, resolveProvider } from "@/lib/cards/registry";
import { PROVIDER_SINGLE_CALL_TIMEOUT_MS } from "@/lib/constants";
import { modelJudge } from "@/lib/evaluation/judge";
import { extractJsonObject } from "@/features/plan/contract";
import { isTutorFeedback, isTutorRequest, isTutorTask } from "@/features/tutor/contract";
import { buildTutorPrompt } from "@/features/tutor/prompts";
import { TUTOR_PROMPT_VERSION } from "@/features/tutor/types";
import { isTutorConceptId, TUTOR_CONCEPTS } from "@/features/tutor/catalog";
import { isHttpError, readJsonObject } from "@/server/http/validation";
import { classifyProviderFailure, failureResponse, providerFailure } from "@/server/http/providerFailure";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const input = await readJsonObject(req, { maxBytes: 64_000 });
    if (!isTutorRequest(input)) return failureResponse(providerFailure("invalid_input"));
    if (!(await isProviderAvailable(input.provider))) return failureResponse(providerFailure("provider_not_configured"));
    const provider = resolveProvider(input.provider, { model: input.ollamaModel, level: input.context.level, learnerLang: "pt", targetLang: "en" });
    if (!provider.complete) return failureResponse(providerFailure("provider_not_configured"));
    const raw = await provider.complete(buildTutorPrompt(input), { signal: req.signal, timeoutMs: PROVIDER_SINGLE_CALL_TIMEOUT_MS });
    let parsed: unknown;
    try { parsed = raw.length <= 20_000 ? extractJsonObject(raw) : null; } catch { parsed = null; }
    const invalid = () => failureResponse(providerFailure("provider_failed", "O tutor enviou uma resposta incompleta. Sua tentativa continua salva; tente novamente."));
    if (input.action === "plan") {
      if (!isTutorTask(parsed)) return invalid();
      if (input.context.previousTask && parsed.situation.trim().toLocaleLowerCase() === input.context.previousTask.situation.trim().toLocaleLowerCase()) return invalid();
      if (input.context.targetSkill && [parsed.goal, parsed.situation, parsed.instruction].some(part => part.toLocaleLowerCase().includes(input.context.targetSkill!.toLocaleLowerCase()))) return invalid();
      return NextResponse.json({ action: "plan", task: { ...parsed, scenarioId: undefined } });
    }
    if (input.action === "evaluate") {
      if (!isTutorFeedback(parsed) || !parsed.skill?.conceptId || parsed.points.some(p => !input.text.includes(p.original))) return invalid();
      if (input.context.targetConceptId && parsed.skill.conceptId !== input.context.targetConceptId) return invalid();
      if (parsed.skill.result === "needs_work" && (!parsed.skill.evidence?.trim() || !input.text.includes(parsed.skill.evidence)
        || !parsed.points.some(p => p.original.includes(parsed.skill!.evidence!) || parsed.skill!.evidence!.includes(p.original)))) return invalid();
      // Stable identifiers survive harmless wording differences in the provider's label.
      if (isTutorConceptId(parsed.skill.conceptId)) parsed.skill.label = TUTOR_CONCEPTS[parsed.skill.conceptId].label;
      else if (input.context.targetSkill) parsed.skill.label = input.context.targetSkill;
      return NextResponse.json({ action: "evaluate", feedback: parsed, judge: modelJudge({ provider: provider.kind, model: provider.modelId, promptVersion: TUTOR_PROMPT_VERSION }) });
    }
    if (!parsed || typeof parsed !== "object" || !("answer" in parsed) || typeof parsed.answer !== "string" || !parsed.answer.trim() || parsed.answer.length > 2400) return invalid();
    return NextResponse.json({ action: "help", answer: parsed.answer });
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    return failureResponse(classifyProviderFailure(err, { signal: req.signal }));
  }
}
