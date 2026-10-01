import type { UiLang } from "@/i18n/config";
import { translate } from "@/i18n/translate";
import { localizeTutorText } from "./localization";
import type { Card } from "@/lib/cards/schema";
import type { ProductionAttempt } from "@/lib/performance/types";
import type { ReviewRecord } from "@/lib/store/repository";
import type { LearningProfile } from "@/features/settings/learningProfile";
import type { TutorAttempt, TutorObservation, TutorPreferences, TutorSession } from "./types";

export const DEFAULT_TUTOR_PREFERENCES: TutorPreferences = { id: "preferences", goal: "", explanationLanguage: "pt", ignoredEvidenceIds: [] };
export const feedbackLabels = { met: "Você comunicou o que a situação precisava", partial: "Você está no caminho; uma parte precisa de ajuste", not_met: "Vamos ajustar uma parte da sua resposta", uncertain: "O tutor ainda não tem certeza" };
const DAY = 86_400_000;
import { allowedTutorAttempt, tutorSkillEvidence, tutorSkillKey } from "./learning";
export { skillFromFirstAttempt, tutorSkillEvidence } from "./learning";

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

export function tutorRecommendation(sessions: TutorSession[], preferences: TutorPreferences, profile: LearningProfile, now: number, lang: UiLang = "pt") {
  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
  const active = sorted.find(s => s.phase !== "complete");
  const latestBySkill = new Map<string, TutorSession>();
  for (const session of [...sessions].sort((a, b) => (b.attempts.at(-1)?.createdAt ?? 0) - (a.attempts.at(-1)?.createdAt ?? 0))) {
    if (session.phase !== "complete" || !session.attempts.length) continue;
    const key = session.skill ? tutorSkillKey(session.skill) : session.id;
    if (!latestBySkill.has(key)) latestBySkill.set(key, session);
  }
  const candidates = [...latestBySkill.values()].filter(s => !s.revisitedAt && !preferences.ignoredEvidenceIds.includes(`session:${s.id}`))
    .map(session => ({ session, at: session.skill ? nextTutorReview(session, session.completedAt ?? session.updatedAt, sessions, preferences) : session.nextReviewAt }))
    .filter((c): c is { session: TutorSession; at: number } => c.at !== undefined);
  const priority = (s: TutorSession) => {
    if (!s.skill) return 5;
    const evidence = tutorSkillEvidence(sessions, s.skill, preferences);
    if (evidence.state === "developing") return 0;
    if (evidence.initialDifficulty && evidence.independent === 0) return 1;
    if (evidence.initialDifficulty && evidence.transfers === 0) return 2;
    return evidence.state === "consistent" ? 4 : 3;
  };
  const due = candidates.filter(c => c.at <= now).sort((a, b) => priority(a.session) - priority(b.session) || a.at - b.at)[0]?.session;
  if (active) return { active, due: undefined, focus: active.task.goal, reason: "Você tem uma sessão em andamento. Sua resposta e o apoio usado estão guardados." };
  if (due) {
    const evidence = due.skill ? tutorSkillEvidence(sessions, due.skill, preferences) : null;
    const reason = !evidence?.initialDifficulty ? "Você já praticou este objetivo. Vamos observar o que consegue recuperar em outra ocasião."
      : evidence.state === "developing" ? "Vamos trabalhar a parte que foi difícil da última vez, em uma situação curta."
        : !evidence.independent ? "Você conseguiu com apoio. Agora é hora de tentar antes de ver um exemplo."
          : !evidence.transfers ? "Você conseguiu sem ajuda recente. Agora vamos tentar usar isso em uma situação diferente."
            : "Você já usou esta habilidade em outra situação. Vamos verificar o que ficou depois de um intervalo.";
    return { active: undefined, due, focus: due.task.goal, reason };
  }
  const upcoming = candidates.filter(c => c.at > now).sort((a, b) => a.at - b.at)[0];
  const customFocus = ["Conversation", "Travel", "Work", "Study & exams", "Movies & podcasts"].includes(profile.focus) ? "" : profile.focus;
  const focus = preferences.goal || customFocus || (profile.objective === "professional" || !profile.onboardingCompleted
    ? "Contar sua experiência profissional" : ({ conversation: "Combinar algo com um colega", travel: "Resolver uma situação de viagem", academic: "Explicar uma ideia de estudo", media: "Contar com suas palavras algo que assistiu" }[profile.objective]));
  return { active: undefined, due: undefined, focus: focus.slice(0, 500), reason: upcoming
    ? translate(lang, "Your next revisit starts on {date}. Today you can practice a new situation.", { date: new Date(upcoming.at).toLocaleDateString(lang === "pt" ? "pt-BR" : "en-US") })
    : "Uma situação curta para produzir inglês. Sua resposta vai orientar o que praticar depois." };
}

/** Scheduling uses the same valid evidence and exposure history as Progress. */
export function nextTutorReview(session: TutorSession, now: number, sessions: TutorSession[] = [], preferences?: TutorPreferences): number | undefined {
  const valid = session.attempts.filter(a => allowedTutorAttempt(a, preferences));
  const last = valid.at(-1);
  if (!last) return undefined;
  const history = [...sessions.filter(s => s.id !== session.id), session];
  const evidence = session.skill ? tutorSkillEvidence(history, session.skill, preferences) : null;
  const days = last.supportUsed || evidence?.supportedAttemptIds.includes(last.id) || last.feedback.status !== "met" || (session.skill && last.feedback.skill?.result !== "demonstrated") ? 1
    : evidence?.state === "consistent" ? 14 : evidence?.state === "transfer_observed" ? 7 : 3;
  return Math.max(now + days * DAY, (evidence?.lastSupportAt ?? 0) + DAY);
}

export function tutorProduction(session: TutorSession, attempt: TutorAttempt): ProductionAttempt {
  const index = session.attempts.findIndex(a => a.id === attempt.id);
  return {
    id: attempt.id, source: "study", stage: index > 0 ? "retry" : "production",
    retryOf: index > 0 ? session.attempts[0].id : undefined,
    context: `Tutor: ${session.task.goal}`, prompt: session.task.instruction,
    text: attempt.text, spoken: attempt.spoken ?? false, wordCount: attempt.text.trim().split(/\s+/).length,
    finished: true, scaffoldUsed: attempt.supportUsed,
    // Teaching points are not an exhaustive count of linguistic errors. Do not feed
    // them into the app's general accuracy/error rates. Tutor has its own task rubric.
    issueCount: 0, evaluated: false,
    judge: attempt.judge, createdAt: attempt.createdAt,
  };
}

export function tutorSummary(session: TutorSession, preferences?: TutorPreferences, lang: UiLang = "pt"): string {
  const first = session.attempts[0];
  const last = session.attempts.at(-1);
  if (!first || !last) return localizeTutorText("Você encerrou sem enviar uma resposta. Nenhum resultado de aprendizagem foi registrado.", lang);
  if (last.disputed) return localizeTutorText("Você contestou a última avaliação. Ela não será usada para orientar o tutor.", lang);
  if (!allowedTutorAttempt(last, preferences)) return localizeTutorText("Você excluiu a última avaliação da memória. Ela não conta no progresso da habilidade.", lang);
  const result = feedbackLabels[last.feedback.status];
  return translate(lang, "{count} {answers}. {result}, according to the AI, {support}. Revisiting on another day will give you another chance to see what stayed.", {
    count: session.attempts.length,
    answers: translate(lang, session.attempts.length === 1 ? "answer recorded" : "answers recorded"),
    result: localizeTutorText(result, lang),
    support: translate(lang, last.supportUsed ? "after support or feedback" : "without asking for support in this session"),
  });
}
