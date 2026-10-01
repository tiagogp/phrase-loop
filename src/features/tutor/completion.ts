import { allowedTutorAttempt, tutorSkillEvidence, tutorSkillKey } from "./learning";
import type { TutorPreferences, TutorSession } from "./types";

/** Presentation only: never changes scheduling or awards learning credit. */
export function tutorCompletion(session: TutorSession, sessions: TutorSession[], preferences: TutorPreferences) {
  const last = session.attempts.at(-1);
  const valid = last && allowedTutorAttempt(last, preferences) && last.feedback.status !== "uncertain";
  const achievement = valid && (last.feedback.status === "met" || last.feedback.skill?.result === "demonstrated")
    ? session.task.successCriteria || session.task.goal : undefined;
  const history = [...sessions.filter(s => s.id !== session.id), session];
  const support = (s: TutorSession) => {
    const attempt = s.attempts.at(-1)!;
    return attempt.supportUsed || s.attempts.length > 1 || !!(s.skill && tutorSkillEvidence(history, s.skill, preferences).supportedAttemptIds.includes(attempt.id));
  };
  const previous = session.skill && sessions.filter(s => s.id !== session.id && s.createdAt < session.createdAt && s.skill
    && tutorSkillKey(s.skill) === tutorSkillKey(session.skill!) && s.attempts.length
    && allowedTutorAttempt(s.attempts.at(-1)!, preferences)).sort((a, b) => b.createdAt - a.createdAt)[0];
  const comparison = previous && last && allowedTutorAttempt(last, preferences) ? {
    previous, current: session, previousSupported: support(previous), currentSupported: support(session),
    days: Math.max(0, Math.floor((session.attempts[0].createdAt - previous.attempts.at(-1)!.createdAt) / 86_400_000)),
  } : undefined;
  return { achievement, comparison };
}
