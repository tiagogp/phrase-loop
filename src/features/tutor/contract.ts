import type { TutorContext, TutorFeedback, TutorObservation, TutorPreferences, TutorRequest, TutorSession, TutorTask } from "./types";
import { isTutorConceptId } from "./catalog";

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max: number, empty = false): v is string => typeof v === "string" && v.length <= max && (empty || !!v.trim());
const timestamp = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

export function isTutorTask(v: unknown): v is TutorTask {
  return object(v) && str(v.goal, 180) && str(v.situation, 800) && str(v.instruction, 800) && str(v.successCriteria, 500)
    && (v.scenarioId === undefined || str(v.scenarioId, 100));
}

export function isTutorFeedback(v: unknown): v is TutorFeedback {
  return object(v) && ["met", "partial", "not_met", "uncertain"].includes(String(v.status)) && str(v.feedback, 1200)
    && Array.isArray(v.points) && v.points.length <= 2 && v.points.every(p => object(p) && str(p.original, 500) && str(p.revised, 500) && str(p.explanation, 800))
    && object(v.example) && str(v.example.english, 500) && str(v.example.meaning, 500) && str(v.retryInstruction, 600)
    && (v.skill === undefined || (object(v.skill) && str(v.skill.label, 120) && ["demonstrated", "needs_work", "uncertain"].includes(String(v.skill.result))
      && (v.skill.conceptId === undefined || v.skill.conceptId === "unclassified" || isTutorConceptId(v.skill.conceptId))
      && (v.skill.evidence === undefined || str(v.skill.evidence, 500, true))));
}

function isObservation(v: unknown): v is TutorObservation {
  return object(v) && str(v.id, 200) && ["production", "review", "phrase", "tutor"].includes(String(v.kind))
    && str(v.label, 200) && str(v.text, 1200) && str(v.detail, 800, true) && timestamp(v.createdAt)
    && (v.supported === null || typeof v.supported === "boolean");
}

export function isTutorContext(v: unknown): v is TutorContext {
  return object(v) && ["A1", "A2", "B1", "B2", "C1", "C2"].includes(String(v.level))
    && [5, 10, 20].includes(v.minutes as number) && ["pt", "en"].includes(String(v.explanationLanguage))
    && str(v.focus, 500) && Array.isArray(v.evidence) && v.evidence.length <= 6 && v.evidence.every(isObservation)
    && (v.previousTask === undefined || isTutorTask(v.previousTask))
    && (v.targetSkill === undefined || str(v.targetSkill, 120))
    && (v.targetConceptId === undefined || isTutorConceptId(v.targetConceptId));
}

export function isTutorRequest(v: unknown): v is TutorRequest {
  if (!object(v) || !["openai", "claude", "ollama", "openrouter"].includes(String(v.provider))
    || (v.ollamaModel !== undefined && !str(v.ollamaModel, 100)) || !isTutorContext(v.context)) return false;
  if (v.action === "plan") return true;
  if (!isTutorTask(v.task)) return false;
  if (v.action === "evaluate") return str(v.text, 3000);
  return v.action === "help" && str(v.question, 600) && str(v.text, 3000, true)
    && (v.feedback === undefined || isTutorFeedback(v.feedback))
    && (v.history === undefined || (Array.isArray(v.history) && v.history.length <= 4 && v.history.every(h => object(h) && str(h.question, 600) && str(h.answer, 2400))));
}

export function isTutorPreferences(v: unknown): v is TutorPreferences {
  return object(v) && v.id === "preferences" && str(v.goal, 500, true) && ["pt", "en"].includes(String(v.explanationLanguage))
    && Array.isArray(v.ignoredEvidenceIds) && v.ignoredEvidenceIds.length <= 1000 && v.ignoredEvidenceIds.every(id => str(id, 200));
}

/** Validate restored records before they can influence prompts or progress. */
export function isTutorSession(v: unknown): v is TutorSession {
  if (!object(v) || !str(v.id, 100) || !Number.isInteger(v.revision) || (v.revision as number) < 1
    || !["practice", "feedback", "complete"].includes(String(v.phase)) || !isTutorTask(v.task)
    || !isTutorContext({ ...v, focus: v.task.goal }) || !str(v.reason, 800) || !str(v.draft, 3000, true)
    || typeof v.supportUsed !== "boolean" || !timestamp(v.createdAt) || !timestamp(v.updatedAt)
    || !Array.isArray(v.attempts) || v.attempts.length > 3 || !Array.isArray(v.help) || v.help.length > 20) return false;
  if (!v.attempts.every(a => object(a) && str(a.id, 100) && str(a.text, 3000) && typeof a.supportUsed === "boolean"
    && (a.spoken === undefined || typeof a.spoken === "boolean")
    && timestamp(a.createdAt) && isTutorFeedback(a.feedback) && object(a.judge) && a.judge.by === "model"
    && str(a.judge.provider, 30) && str(a.judge.promptVersion, 100)
    && (a.judge.model === undefined || str(a.judge.model, 200))
    && (a.disputed === undefined || typeof a.disputed === "boolean"))) return false;
  if (!v.help.every(h => object(h) && str(h.question, 600) && str(h.answer, 2400) && timestamp(h.createdAt))) return false;
  for (const key of ["completedAt", "nextReviewAt", "revisitedAt"]) if (v[key] !== undefined && !timestamp(v[key])) return false;
  for (const key of ["parentSessionId", "savedPhraseId", "sourceCardId"]) if (v[key] !== undefined && !str(v[key], 100)) return false;
  if (v.skill !== undefined && (!object(v.skill) || !str(v.skill.id, 100) || !str(v.skill.label, 120) || !str(v.skill.originContext, 800))) return false;
  if (object(v.skill) && ((v.skill.conceptId !== undefined && !isTutorConceptId(v.skill.conceptId)) || (v.skill.originSessionId !== undefined && !str(v.skill.originSessionId, 100)))) return false;
  if (v.exposures !== undefined && (!Array.isArray(v.exposures) || !v.exposures.every(e => object(e) && str(e.id, 100) && ["feedback", "hint", "history", "source"].includes(String(e.kind)) && timestamp(e.at)))) return false;
  if (v.draftSpoken !== undefined && typeof v.draftSpoken !== "boolean") return false;
  if (v.extraPractice !== undefined && typeof v.extraPractice !== "boolean") return false;
  if (v.provider !== undefined && !["openai", "claude", "openrouter", "ollama"].includes(String(v.provider))) return false;
  if (v.model !== undefined && !str(v.model, 100)) return false;
  return !(v.phase === "feedback" && v.attempts.length === 0);
}
