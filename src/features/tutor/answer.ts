import type { TutorAttempt, TutorFeedback, TutorSession } from "./types";

/** Editable transcripts carry provenance, never a pronunciation verdict. */
export function tutorAnswer(session: TutorSession, id: string, createdAt: number, feedback: TutorFeedback, judge: TutorAttempt["judge"]): TutorAttempt {
  return { id, text: session.draft.trim(), spoken: session.draftSpoken ?? false,
    supportUsed: session.supportUsed || session.attempts.length > 0, createdAt, feedback, judge };
}
