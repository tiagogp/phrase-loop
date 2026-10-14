import { NextRequest, NextResponse } from "next/server";
import { isProviderAvailable, resolveProvider } from "@/lib/cards/registry";
import { PROVIDER_SINGLE_CALL_TIMEOUT_MS } from "@/lib/constants";
import { modelJudge } from "@/lib/evaluation/judge";
import { extractJsonObject } from "@/features/plan/contract";
import { isTutorFeedback, isTutorRequest, isTutorTask, locateExcerpt } from "@/features/tutor/contract";
import { buildTutorPrompt } from "@/features/tutor/prompts";
import { tutorResponseSchema } from "@/features/tutor/responseSchema";
import { TUTOR_PROMPT_VERSION } from "@/features/tutor/types";
import { isTutorConceptId, TUTOR_CONCEPTS } from "@/features/tutor/catalog";
import { isHttpError, readJsonObject } from "@/server/http/validation";
import { classifyProviderFailure, failureResponse, providerFailure } from "@/server/http/providerFailure";
import { logTutor } from "@/server/tutorLog";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const ms = () => Date.now() - startedAt;
  let request: Record<string, unknown> = {};
  try {
    const input = await readJsonObject(req, { maxBytes: 64_000 });
    if (!isTutorRequest(input)) {
      logTutor({ step: "invalid_input", action: (input as Record<string, unknown>)?.action });
      return failureResponse(providerFailure("invalid_input"));
    }
    request = { action: input.action, provider: input.provider, requestedModel: input.ollamaModel };
    if (!(await isProviderAvailable(input.provider))) {
      logTutor({ ...request, step: "provider_unavailable", ms: ms() });
      return failureResponse(providerFailure("provider_not_configured"));
    }
    const provider = resolveProvider(input.provider, { model: input.ollamaModel, level: input.context.level, learnerLang: "pt", targetLang: "en" });
    request = { ...request, model: provider.modelId };
    if (!provider.complete) return failureResponse(providerFailure("provider_not_configured"));
    const prompt = buildTutorPrompt(input);
    logTutor({ ...request, step: "start", text: "text" in input ? input.text : undefined, promptChars: prompt.length, timeoutMs: PROVIDER_SINGLE_CALL_TIMEOUT_MS });
    const raw = await provider.complete(prompt, { signal: req.signal, timeoutMs: PROVIDER_SINGLE_CALL_TIMEOUT_MS, responseSchema: tutorResponseSchema(input) });
    logTutor({ ...request, step: "model_replied", ms: ms(), raw });
    let parsed: unknown;
    try { parsed = raw.length <= 20_000 ? extractJsonObject(raw) : null; } catch { parsed = null; }
    const invalid = (reason: string) => {
      logTutor({ ...request, step: "rejected", reason, ms: ms(), parsed });
      return failureResponse(providerFailure("provider_failed", "O tutor enviou uma resposta incompleta. Sua tentativa continua salva; tente novamente."));
    };
    if (parsed === null) return invalid(raw.length > 20_000 ? "reply over 20000 chars" : "reply is not a JSON object");
    if (input.action === "plan") {
      if (!isTutorTask(parsed)) return invalid(`schema: ${schemaProblems(parsed, TASK_FIELDS)}`);
      if (input.context.previousTask && parsed.situation.trim().toLocaleLowerCase() === input.context.previousTask.situation.trim().toLocaleLowerCase()) return invalid("repeated situation");
      if (input.context.targetSkill && [parsed.goal, parsed.situation, parsed.instruction].some(part => part.toLocaleLowerCase().includes(input.context.targetSkill!.toLocaleLowerCase()))) return invalid("names target skill");
      logTutor({ ...request, step: "ok", ms: ms() });
      return NextResponse.json({ action: "plan", task: { ...parsed, scenarioId: undefined } });
    }
    if (input.action === "evaluate") {
      // Small local models often leave out an empty `points` list or send an empty retry line.
      // Those are harmless gaps, so fill them rather than discarding the whole feedback.
      if (parsed && typeof parsed === "object") {
        const feedback = parsed as Record<string, unknown>;
        // Backends without schema enforcement sometimes put a skill verdict (e.g.
        // needs_work) in the task status. Show the coaching without guessing a grade.
        if (typeof feedback.status === "string" && feedback.status.trim() && feedback.status.length <= 120
          && !["met", "partial", "not_met", "uncertain"].includes(feedback.status)) {
          logTutor({ ...request, step: "uncertain_status", status: feedback.status });
          feedback.status = "uncertain";
        }
        // A model can supply useful coaching without a skill diagnosis. Keep that
        // feedback; only retain a known follow-up target, with no success/failure claim.
        if (feedback.skill == null) {
          const conceptId = isTutorConceptId(input.context.targetConceptId) ? input.context.targetConceptId : undefined;
          feedback.skill = conceptId || input.context.targetSkill ? {
            label: conceptId ? TUTOR_CONCEPTS[conceptId].label : input.context.targetSkill,
            conceptId: conceptId ?? "unclassified",
            result: "uncertain",
            evidence: "",
          } : undefined;
          logTutor({ ...request, step: "missing_skill", targetConceptId: conceptId });
        }
        if (feedback.points === undefined) feedback.points = [];
        if (typeof feedback.retryInstruction === "string" && !feedback.retryInstruction.trim()) {
          feedback.retryInstruction = "Tente de novo nesta mesma situação, aplicando o feedback.";
        }
        // Quotes must stay exact excerpts of the answer, so snap near-verbatim quotes back to the learner's words.
        if (Array.isArray(feedback.points)) for (const point of feedback.points) {
          if (point && typeof point === "object" && typeof point.original === "string") point.original = locateExcerpt(input.text, point.original) ?? point.original;
        }
        const skill = feedback.skill as Record<string, unknown> | undefined;
        if (skill && typeof skill === "object" && typeof skill.evidence === "string" && skill.evidence.trim()) {
          skill.evidence = locateExcerpt(input.text, skill.evidence) ?? skill.evidence;
        }
      }
      if (!isTutorFeedback(parsed) || (parsed.skill && !parsed.skill.conceptId)) return invalid(`schema: ${schemaProblems(parsed, FEEDBACK_FIELDS)}`);
      // An invented quote invalidates that correction, not the rest of the feedback.
      const invented = parsed.points.filter(p => !input.text.includes(p.original));
      if (invented.length) {
        logTutor({ ...request, step: "dropped_points", originals: invented.map(p => p.original) });
        parsed.points = parsed.points.filter(p => !invented.includes(p));
      }
      if (input.context.targetConceptId && parsed.skill?.conceptId !== input.context.targetConceptId) return invalid(`concept mismatch: expected ${input.context.targetConceptId}, got ${parsed.skill?.conceptId}`);
      // A needs_work diagnosis is only recorded when grounded in a correction; otherwise keep the feedback
      // but record the skill as uncertain, which neither credits nor penalizes it.
      const evidence = parsed.skill?.evidence;
      if (parsed.skill?.result === "needs_work" && (!evidence?.trim() || !input.text.includes(evidence)
        || !parsed.points.some(p => p.original.includes(evidence) || evidence.includes(p.original)))) {
        logTutor({ ...request, step: "skill_downgraded", evidence, points: parsed.points.map(p => p.original) });
        parsed.skill = { ...parsed.skill, result: "uncertain", evidence: "" };
      }
      // Stable identifiers survive harmless wording differences in the provider's label.
      if (parsed.skill) {
        if (isTutorConceptId(parsed.skill.conceptId)) parsed.skill.label = TUTOR_CONCEPTS[parsed.skill.conceptId].label;
        else if (input.context.targetSkill) parsed.skill.label = input.context.targetSkill;
      }
      logTutor({ ...request, step: "ok", ms: ms() });
      return NextResponse.json({ action: "evaluate", feedback: parsed, judge: modelJudge({ provider: provider.kind, model: provider.modelId, promptVersion: TUTOR_PROMPT_VERSION }) });
    }
    if (!parsed || typeof parsed !== "object" || !("answer" in parsed) || typeof parsed.answer !== "string" || !parsed.answer.trim() || parsed.answer.length > 2400) return invalid("schema: answer missing, empty or over 2400 chars");
    logTutor({ ...request, step: "ok", ms: ms() });
    return NextResponse.json({ action: "help", answer: parsed.answer });
  } catch (err) {
    if (isHttpError(err)) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    const failure = classifyProviderFailure(err, { signal: req.signal });
    logTutor({ ...request, step: "error", ms: ms(), kind: failure.code, error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
      status: (err as { status?: unknown })?.status, clientAborted: req.signal.aborted });
    return failureResponse(failure);
  }
}

const TASK_FIELDS = ["goal", "situation", "instruction", "successCriteria"];
const FEEDBACK_FIELDS = ["status", "feedback", "points", "example", "retryInstruction"];

/** Name the fields a reply got wrong, so the log says what to fix instead of only "schema". */
function schemaProblems(value: unknown, fields: string[]): string {
  if (!value || typeof value !== "object") return "not an object";
  const record = value as Record<string, unknown>;
  const problems = fields.filter(f => record[f] === undefined || record[f] === null || record[f] === "").map(f => `missing ${f}`);
  const skill = record.skill as Record<string, unknown> | undefined;
  if (skill && typeof skill === "object") {
    if (!skill.conceptId) problems.push("missing skill.conceptId");
    else if (skill.conceptId !== "unclassified" && !isTutorConceptId(skill.conceptId)) problems.push(`unknown skill.conceptId ${JSON.stringify(skill.conceptId)}`);
    if (!["demonstrated", "needs_work", "uncertain"].includes(String(skill.result))) problems.push(`bad skill.result ${JSON.stringify(skill.result)}`);
  }
  if (record.status !== undefined && fields.includes("status") && !["met", "partial", "not_met", "uncertain"].includes(String(record.status))) problems.push(`bad status ${JSON.stringify(record.status)}`);
  if (Array.isArray(record.points) && record.points.length > 2) problems.push(`${record.points.length} points (max 2)`);
  return problems.join(", ") || "a field has the wrong type or is too long";
}
