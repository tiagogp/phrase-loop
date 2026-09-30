import { tokenize } from "@/lib/language/pattern";
import { isTutorConceptId, TUTOR_CONCEPTS, verifiedTutorContext } from "./catalog";
import type { TutorAttempt, TutorPreferences, TutorSession, TutorSkill } from "./types";

export const TUTOR_RECALL_DELAY = 86_400_000;
export const tutorSkillKey = (skill: TutorSkill) => isTutorConceptId(skill.conceptId) ? skill.conceptId : skill.id;
export const tutorSkillLabel = (skill: TutorSkill) => isTutorConceptId(skill.conceptId) ? TUTOR_CONCEPTS[skill.conceptId].label : skill.label;
export const tutorSkillStates = { developing: "Em desenvolvimento", awaiting_independent: "Aguardando confirmação independente", transfer_observed: "Transferência observada", consistent: "Evidência consistente" };

export function skillFromFirstAttempt(session: TutorSession, attempt: TutorAttempt): TutorSkill | undefined {
  if (session.skill) return session.skill;
  const signal = attempt.feedback.skill;
  if (!signal) return undefined;
  const conceptId = isTutorConceptId(signal.conceptId) ? signal.conceptId : undefined;
  return { id: conceptId ?? session.id, conceptId, label: conceptId ? TUTOR_CONCEPTS[conceptId].label : signal.label,
    originSessionId: session.id, originContext: session.task.situation };
}

export function uniqueTutorSkills(sessions: TutorSession[]): TutorSkill[] {
  return [...new Map(sessions.filter(s => s.skill).map(s => [tutorSkillKey(s.skill!), s.skill!])).values()];
}

export function allowedTutorAttempt(attempt: TutorAttempt, preferences?: TutorPreferences): boolean {
  return !attempt.disputed && !preferences?.ignoredEvidenceIds.includes(`tutor:${attempt.id}`);
}

/** Feedback with a precise quote supports a skill diagnosis; general task failure does not. */
export function hasTutorDiagnosis(attempt: TutorAttempt): boolean {
  const signal = attempt.feedback.skill;
  return signal?.result === "needs_work" && !!signal.evidence?.trim() && attempt.text.includes(signal.evidence)
    && attempt.feedback.points.some(p => p.original.includes(signal.evidence!) || signal.evidence!.includes(p.original));
}

/** Include actual exposures even when the model's evaluation was disputed/ignored. */
function exposureTimes(session: TutorSession): number[] {
  return [...(session.exposures ?? []).map(e => e.at), ...session.help.map(h => h.createdAt),
    // Legacy records did not store the display time. Use a conservative later timestamp.
    ...session.attempts.filter(a => !session.exposures?.some(e => e.kind === "feedback" && e.at >= a.createdAt)).map(a => Math.max(a.createdAt + 1, session.completedAt ?? session.updatedAt))];
}

export function tutorSkillEvidence(sessions: TutorSession[], skill: TutorSkill, preferences?: TutorPreferences) {
  const related = sessions.filter(s => s.skill && tutorSkillKey(s.skill) === tutorSkillKey(skill));
  const exposures = related.flatMap(exposureTimes).sort((a, b) => a - b);
  const rows = related.flatMap(session => session.attempts.map((attempt, index) => ({ session, attempt, index })))
    .filter(row => allowedTutorAttempt(row.attempt, preferences) && (!isTutorConceptId(skill.conceptId) || row.attempt.feedback.skill?.conceptId === skill.conceptId))
    .sort((a, b) => a.attempt.createdAt - b.attempt.createdAt || a.index - b.index);
  const diagnoses = rows.filter(r => hasTutorDiagnosis(r.attempt));
  const lastSupportBefore = (at: number) => Math.max(0, ...exposures.filter(t => t <= at));
  const supported = (r: typeof rows[number]) => r.attempt.supportUsed || r.index > 0 || (lastSupportBefore(r.attempt.createdAt) > 0 && r.attempt.createdAt - lastSupportBefore(r.attempt.createdAt) < TUTOR_RECALL_DELAY);
  const successful = (r: typeof rows[number]) => r.attempt.feedback.skill?.result === "demonstrated" && r.attempt.feedback.status !== "uncertain";
  const assisted = rows.filter(r => successful(r) && supported(r));
  const independent = rows.filter(r => successful(r) && !supported(r));
  const canonical = (text: string) => tokenize(text).join(" ");
  const transfers = independent.filter(row => {
    const at = row.attempt.createdAt;
    if (!diagnoses.some(d => d.attempt.createdAt < at && at - d.attempt.createdAt >= TUTOR_RECALL_DELAY)) return false;
    const context = verifiedTutorContext(row.session.task, skill.conceptId);
    if (!context) return false;
    const earlier = rows.filter(r => r.attempt.createdAt < at);
    const contexts = earlier.map(r => verifiedTutorContext(r.session.task, skill.conceptId)).filter(Boolean);
    // Need an observed, verified reference context. Repeated contexts are recall, not new transfer.
    if (!contexts.length || contexts.includes(context)) return false;
    const answer = canonical(row.attempt.text);
    const examples = related.flatMap(s => s.attempts.filter(a => a.createdAt < at).flatMap(a => [a.text, a.feedback.example.english]));
    return !examples.some(example => canonical(example).length > 15 && answer.includes(canonical(example)));
  });
  const improvements = new Set(rows.filter(r => successful(r) && r.index > 0 && diagnoses.some(d => d.session.id === r.session.id && d.attempt.createdAt < r.attempt.createdAt && canonical(d.attempt.text) !== canonical(r.attempt.text))).map(r => r.session.id)).size;
  const last = rows.at(-1);
  const lastFailureAt = diagnoses.at(-1)?.attempt.createdAt ?? 0;
  const afterFailure = transfers.filter(r => r.attempt.createdAt > lastFailureAt);
  const transferContexts = new Set(afterFailure.map(r => verifiedTutorContext(r.session.task, skill.conceptId)));
  const separated = afterFailure.length > 1 && afterFailure.at(-1)!.attempt.createdAt - afterFailure[0].attempt.createdAt >= TUTOR_RECALL_DELAY;
  const state: keyof typeof tutorSkillStates = last && !successful(last) ? "developing"
    : transferContexts.size >= 2 && separated ? "consistent"
      : afterFailure.length ? "transfer_observed" : "awaiting_independent";
  const recent = rows.slice(-5);
  return {
    attempts: rows.length, exposures: exposures.length, assisted: assisted.length, improvements, independent: independent.length,
    failed: diagnoses.length, recentFailures: recent.filter(r => hasTutorDiagnosis(r.attempt)).length,
    transfers: transfers.length, contexts: new Set(transfers.map(r => verifiedTutorContext(r.session.task, skill.conceptId))).size,
    initialDifficulty: diagnoses.length > 0, state,
    lastPracticedAt: last?.attempt.createdAt, lastSupportAt: exposures.at(-1),
    before: diagnoses[0], after: transfers.at(-1),
    supportedAttemptIds: rows.filter(supported).map(r => r.attempt.id),
    transferAttemptIds: transfers.map(r => r.attempt.id),
  };
}
