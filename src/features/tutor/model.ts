import type { Card } from "@/lib/cards/schema";
import type { ProductionAttempt } from "@/lib/performance/types";
import type { ReviewRecord } from "@/lib/store/repository";
import type { LearningProfile } from "@/features/settings/learningProfile";
import type { TutorAttempt, TutorObservation, TutorPreferences, TutorSession } from "./types";

export const DEFAULT_TUTOR_PREFERENCES: TutorPreferences = { id: "preferences", goal: "", explanationLanguage: "pt", ignoredEvidenceIds: [] };
export const feedbackLabels = { met: "Objetivo atendido", partial: "Objetivo parcialmente atendido", not_met: "Ainda não atendeu ao objetivo", uncertain: "Avaliação inconclusiva" };
const DAY = 86_400_000;

export function createTutorSession(input: Pick<TutorSession, "task" | "level" | "minutes" | "explanationLanguage" | "reason" | "evidence" | "parentSessionId" | "supportUsed" | "provider" | "model">): TutorSession {
  const now = Date.now();
  return { ...input, id: crypto.randomUUID(), revision: 1, phase: "practice", draft: "", attempts: [], help: [], createdAt: now, updatedAt: now };
}

function sessionObservations(s: TutorSession): TutorObservation[] {
  return s.attempts.filter(a => !a.disputed).map(a => ({
    id: `tutor:${a.id}`, kind: "tutor", label: s.task.goal.slice(0, 200), text: a.text.slice(0, 1200),
    detail: `${feedbackLabels[a.feedback.status]} (avaliação de IA). ${a.feedback.feedback}`.slice(0, 800), createdAt: a.createdAt, supported: a.supportUsed,
  }));
}

export function allowedTutorEvidence(evidence: TutorObservation[], preferences: TutorPreferences, sessions: TutorSession[]): TutorObservation[] {
  const ignored = new Set([...preferences.ignoredEvidenceIds, ...sessions.flatMap(s => s.attempts.filter(a => a.disputed).map(a => `tutor:${a.id}`))]);
  return evidence.filter(o => !ignored.has(o.id));
}

/** Explicit material and the linked previous session take precedence, even when the
 * earlier session no longer appears among the most recent general observations. */
export function selectTutorEvidence(input: { observations: TutorObservation[]; preferences: TutorPreferences; sessions: TutorSession[]; focus: string; source?: Card; parent?: TutorSession }): TutorObservation[] {
  const tokens = input.focus.toLocaleLowerCase().split(/\W+/).filter(t => t.length > 3);
  const score = (o: TutorObservation) => tokens.filter(t => `${o.label} ${o.detail} ${o.text}`.toLocaleLowerCase().includes(t)).length;
  const relevant = [...input.observations].sort((a, b) => score(b) - score(a) || b.createdAt - a.createdAt);
  const prioritized = [...(input.source ? [phraseObservation(input.source)] : []), ...(input.parent ? sessionObservations(input.parent).reverse() : []), ...relevant];
  const unique = [...new Map(prioritized.map(o => [o.id, o])).values()];
  return allowedTutorEvidence(unique, input.preferences, input.sessions).slice(0, 6);
}

export function tutorObservations(input: { cards: Card[]; production: ProductionAttempt[]; reviews: ReviewRecord[]; sessions: TutorSession[] }): TutorObservation[] {
  const sessionAttemptIds = new Set(input.sessions.flatMap(s => s.attempts.map(a => a.id)));
  const cardsById = new Map(input.cards.map(c => [c.id, c]));
  const observations: TutorObservation[] = [
    ...input.production.filter(a => a.finished && !a.skipped && a.text.trim() && !sessionAttemptIds.has(a.id)).map(a => ({
      id: `production:${a.id}`, kind: "production" as const, label: a.source === "conversation" ? "Resposta em conversa" : "Resposta em prática",
      text: a.text.slice(0, 1200), detail: `${a.context ?? a.prompt ?? ""} — ${a.evaluated ? (a.taskCompleted === true ? "Tarefa atendida na avaliação registrada" : a.taskCompleted === false ? "Tarefa não atendida na avaliação registrada" : "Resposta avaliada") : "Sem avaliação"}`.slice(0, 800),
      createdAt: a.createdAt, supported: a.scaffoldUsed ?? null,
    })),
    ...input.reviews.filter(r => r.responseText?.trim()).map(r => ({
      id: `review:${r.id}`, kind: "review" as const, label: "Resposta em revisão", text: r.responseText!.slice(0, 1200),
      detail: `${cardsById.get(r.cardId)?.concept ?? "Frase salva"} — ${r.responseCorrect === true ? "Resposta aceita pelo avaliador" : r.responseCorrect === false ? "Resposta não aceita pelo avaliador" : "Sem avaliação objetiva"}`.slice(0, 800),
      createdAt: r.reviewedAt, supported: r.hintUsed === true || (r.scaffoldLevel ?? 0) > 0 ? true : r.hintUsed === false ? false : null,
    })),
    ...input.sessions.flatMap(sessionObservations),
  ];
  return observations.sort((a, b) => b.createdAt - a.createdAt).slice(0, 60);
}

export function phraseObservation(card: Card): TutorObservation {
  return { id: `phrase:${card.id}`, kind: "phrase", label: "Frase salva — material de estudo", text: (card.direction === "production" ? card.back : card.front).slice(0, 1200),
    detail: (card.direction === "production" ? card.front : card.back).slice(0, 800), createdAt: card.createdAt, supported: null };
}

export function tutorRecommendation(sessions: TutorSession[], preferences: TutorPreferences, profile: LearningProfile, now: number) {
  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
  const active = sorted.find(s => s.phase !== "complete");
  const due = sorted.filter(s => s.phase === "complete" && s.nextReviewAt && s.nextReviewAt <= now && !s.revisitedAt
    && !preferences.ignoredEvidenceIds.includes(`session:${s.id}`)).sort((a, b) => a.nextReviewAt! - b.nextReviewAt!)[0];
  if (active) return { active, due: undefined, focus: active.task.goal, reason: "Você tem uma sessão em andamento. Sua resposta e o apoio usado estão guardados." };
  if (due) return { active: undefined, due, focus: due.task.goal, reason: `Você praticou este objetivo em ${new Date(due.completedAt ?? due.updatedAt).toLocaleDateString("pt-BR")}. Vamos tentar outra situação antes de ver um exemplo.` };
  const customFocus = ["Conversation", "Travel", "Work", "Study & exams", "Movies & podcasts"].includes(profile.focus) ? "" : profile.focus;
  const focus = preferences.goal || customFocus || ({ conversation: "Pedir e combinar algo do dia a dia", professional: "Resolver uma situação de trabalho", travel: "Resolver uma situação de viagem", academic: "Explicar uma ideia de estudo", media: "Contar com suas palavras algo que assistiu" }[profile.objective]);
  return { active: undefined, due: undefined, focus: focus.slice(0, 500), reason: sorted.length ? "Vamos trabalhar seu objetivo com uma resposta própria. O tutor pode usar os registros que você permitir." : "Vamos começar pelo seu objetivo. A primeira resposta ajuda o tutor a conhecer o que você já consegue fazer." };
}

/** Deterministic follow-up policy, separate from FSRS and never a claim of mastery. */
export function nextTutorReview(session: TutorSession, now: number): number | undefined {
  const last = session.attempts.at(-1);
  if (!last) return undefined;
  return now + (last.feedback.status === "met" && !last.supportUsed && !last.disputed ? 3 : 1) * DAY;
}

export function tutorProduction(session: TutorSession, attempt: TutorAttempt): ProductionAttempt {
  const index = session.attempts.findIndex(a => a.id === attempt.id);
  return {
    id: attempt.id, source: "study", stage: index > 0 ? "retry" : "production",
    retryOf: index > 0 ? session.attempts[0].id : undefined,
    context: `Tutor: ${session.task.goal}`, prompt: session.task.instruction,
    text: attempt.text, spoken: false, wordCount: attempt.text.trim().split(/\s+/).length,
    finished: true, scaffoldUsed: attempt.supportUsed,
    // Teaching points are not an exhaustive count of linguistic errors. Do not feed
    // them into the app's general accuracy/error rates. Tutor has its own task rubric.
    issueCount: 0, evaluated: false,
    judge: attempt.judge, createdAt: attempt.createdAt,
  };
}

export function tutorSummary(session: TutorSession): string {
  const first = session.attempts[0];
  const last = session.attempts.at(-1);
  if (!first || !last) return "Você encerrou sem enviar uma resposta. Nenhum resultado de aprendizagem foi registrado.";
  if (last.disputed) return "Você contestou a última avaliação. Ela não será usada para orientar o tutor.";
  const result = feedbackLabels[last.feedback.status];
  return `${session.attempts.length} ${session.attempts.length === 1 ? "resposta registrada" : "respostas registradas"}. ${result}, segundo a IA, ${last.supportUsed ? "após apoio ou feedback" : "sem pedir apoio nesta sessão"}. A retomada em outro dia dará uma nova oportunidade de observar o que ficou.`;
}
