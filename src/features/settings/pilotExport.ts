import type { TutorPreferences, TutorSession } from "@/features/tutor/types";
import { allowedTutorAttempt, tutorSkillEvidence } from "@/features/tutor/learning";
import { isTutorConceptId, verifiedTutorContext } from "@/features/tutor/catalog";
import type { ProductionAttempt, RetryOutcome } from "@/lib/performance/types";
import type { ReviewRecord } from "@/lib/store/repository";
import type { ActivityEvent } from "@/lib/store/activityLog";

const DAY = 86_400_000;
export interface PilotHistory {
  sessions: TutorSession[];
  preferences: TutorPreferences;
  production: ProductionAttempt[];
  retries: RetryOutcome[];
  reviews: ReviewRecord[];
  activities: ActivityEvent[];
  profileCreatedAt?: number;
}

/** Explicit projection: no raw histories, generated tasks, feedback, recordings or keys. */
export function buildPilotExport(history: PilotHistory, now: number, includeAnswers = false) {
  const sessions = history.sessions.filter(s => s.createdAt <= now);
  const tutorIds = new Set(sessions.flatMap(s => s.attempts.map(a => a.id)));
  const production = history.production.filter(p => !tutorIds.has(p.id) && p.createdAt <= now && p.text.trim());
  const tutorRows = sessions.flatMap(session => {
    const supportedIds = session.skill ? tutorSkillEvidence(sessions, session.skill, history.preferences).supportedAttemptIds : [];
    return session.attempts.filter(a => a.createdAt <= now).map((attempt, index) => ({
      id: attempt.id, at: attempt.createdAt, sessionId: session.id, retry: index > 0,
      supported: attempt.supportUsed || index > 0 || supportedIds.includes(attempt.id), spoken: attempt.spoken ?? false,
      conceptId: isTutorConceptId(session.skill?.conceptId) ? session.skill.conceptId : "unclassified",
      scenarioId: verifiedTutorContext(session.task, session.skill?.conceptId) ? session.task.scenarioId! : null,
      assessmentIncluded: allowedTutorAttempt(attempt, history.preferences) && attempt.feedback.status !== "uncertain",
    }));
  });
  const rows = [...tutorRows.map(r => ({ id: r.id, at: r.at, kind: "tutor", supported: r.supported })),
    ...production.map(p => ({ id: p.id, at: p.createdAt, kind: p.selfAssessment ? "local_self_assessment" : "production", supported: p.scaffoldUsed ?? null }))].sort((a, b) => a.at - b.at);
  const starts = [...sessions.map(s => s.createdAt), ...history.activities.filter(e => e.type === "first_run_started" && e.ts <= now).map(e => e.ts),
    ...(history.profileCreatedAt && history.profileCreatedAt <= now ? [history.profileCreatedAt] : [])].filter(at => at > 0);
  const startedAt = starts.length ? Math.min(...starts) : null;
  const firstAttemptAt = rows[0]?.at ?? null;
  const completions = [...sessions.filter(s => s.phase === "complete" && s.completedAt && s.completedAt <= now && s.attempts.some(a => allowedTutorAttempt(a, history.preferences) && a.feedback.status !== "uncertain"))
    .map(s => ({ at: s.completedAt!, kind: "tutor", assessed: true })),
    ...production.filter(p => p.finished && p.completedAt && p.completedAt <= now).map(p => ({ at: p.completedAt!, kind: p.selfAssessment ? "local_self_assessment" : "production", assessed: p.evaluated === true }))]
    .sort((a, b) => a.at - b.at);
  const firstPracticeCompleted = completions[0] ?? null;
  const returned = (min: number, max: number) => {
    const baseline = firstPracticeCompleted?.at;
    return { attempts: baseline === undefined ? [] : rows.filter(r => r.at - baseline >= min * DAY && r.at - baseline < max * DAY)
      .map(r => ({ ...r, elapsedMs: r.at - baseline })), windowComplete: baseline !== undefined && now - baseline >= max * DAY };
  };
  const skills = Object.fromEntries([...new Set(tutorRows.map(r => r.conceptId))].map(id => {
    const related = tutorRows.filter(r => r.conceptId === id);
    return [id, { attempts: related.length, supportedAttempts: related.filter(r => r.supported).length,
      situations: Object.fromEntries([...new Set(related.map(r => r.scenarioId ?? "unverified"))].map(scenario => [scenario, related.filter(r => (r.scenarioId ?? "unverified") === scenario).length])) }];
  }));
  return {
    app: "PhraseLoop", schemaVersion: 1, exportedAt: new Date(now).toISOString(), includesAnswers: includeAnswers,
    startedAt, firstAttemptAt, timeToFirstAttemptMs: startedAt !== null && firstAttemptAt !== null && firstAttemptAt >= startedAt ? firstAttemptAt - startedAt : null,
    firstPracticeCompleted,
    retries: { tutorAttempts: tutorRows.filter(r => r.retry).length, otherProductionAttempts: production.filter(p => p.stage === "retry").length,
      outcomes: history.retries.filter(r => r.createdAt <= now).map(r => ({ id: r.id, at: r.createdAt, resolution: r.resolution ?? (r.resolved ? "completed" : "deferred") })) },
    returns: { d1: returned(1, 2), d7: returned(5, 11) },
    support: { tutorAttempts: tutorRows.filter(r => r.supported).length, productionAttempts: production.filter(p => p.scaffoldUsed).length,
      unknownProductionAttempts: production.filter(p => p.scaffoldUsed === undefined).length },
    bySkill: skills, tutorAttempts: tutorRows,
    definitions: { d1: "[24h,48h) after first completed practice", d7: "[5,11) days after first completed practice (D7 protocol: days 5–10)",
      firstAttemptClock: "earliest known profile creation, first-run start or tutor session start; null when unavailable",
      completion: "tutor completion with eligible non-uncertain assessment, or explicitly timestamped production completion",
      counts: "process measures, not learning outcomes; retry production and outcome records are separate to avoid double counting" },
    ...(includeAnswers ? { answers: [...sessions.flatMap(s => s.attempts.filter(a => a.createdAt <= now).map(a => ({ id: a.id, text: a.text }))),
      ...production.map(p => ({ id: p.id, text: p.text })), ...history.retries.filter(r => r.createdAt <= now).map(r => ({ id: r.id, text: r.text })),
      ...history.reviews.filter(r => r.reviewedAt <= now && r.responseText).map(r => ({ id: r.id, text: r.responseText! }))] } : {}),
  };
}
