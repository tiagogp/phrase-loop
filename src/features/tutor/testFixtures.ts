import { tutorScenarioFor } from "./catalog";
import { TUTOR_PROMPT_VERSION, type TutorAttempt, type TutorSession } from "./types";

export function tutorSession(overrides: Partial<TutorSession> = {}): TutorSession {
  return { id: "session-1", revision: 1, phase: "practice", level: "A2", minutes: 5, explanationLanguage: "pt",
    task: { goal: "Remarcar um compromisso", situation: "Sua consulta é na terça, mas você só pode na sexta.", instruction: "Peça para mudar o dia da consulta.", successCriteria: "Pedir uma mudança e indicar sexta-feira." },
    reason: "Você escolheu este objetivo.", evidence: [], draft: "", supportUsed: false, attempts: [], help: [], createdAt: 1000, updatedAt: 1000, ...overrides };
}

export function tutorAttempt(overrides: Partial<TutorAttempt> = {}): TutorAttempt {
  return { id: "attempt-1", text: "I'd like to change my appointment to Friday.", supportUsed: false, createdAt: 2000,
    feedback: { status: "met", feedback: "Você pediu a mudança e indicou o dia.", points: [], example: { english: "Could I move my appointment to Friday?", meaning: "Eu poderia mudar minha consulta para sexta-feira?" }, retryInstruction: "Faça o mesmo pedido com suas palavras.", skill: { conceptId: "polite-requests", evidence: "", label: "Pedir mudança de data com educação", result: "demonstrated" } },
    judge: { by: "model", provider: "ollama", model: "test-model", promptVersion: TUTOR_PROMPT_VERSION }, ...overrides };
}

export const DAY = 86_400_000;
export function durationHistory(): [TutorSession, TutorSession] {
  const skill = { id: "present-perfect-duration", conceptId: "present-perfect-duration", label: "Falar sobre duração com present perfect", originContext: tutorScenarioFor("duration-interview-v1").situation, originSessionId: "origin" };
  const signal = { label: skill.label, conceptId: skill.conceptId, evidence: "", result: "demonstrated" as const };
  const first = tutorAttempt({ id: "initial", text: "I have five years working with React.", createdAt: 2000,
    feedback: { ...tutorAttempt().feedback, status: "partial", skill: { ...signal, result: "needs_work", evidence: "I have five years" },
      points: [{ original: "I have five years", revised: "I have been working for five years", explanation: "Use uma forma que expresse uma experiência ainda em andamento." }],
      example: { english: "I have been working with React for five years.", meaning: "Trabalho com React há cinco anos." } } });
  const origin = tutorSession({ id: "origin", skill, task: tutorScenarioFor("duration-interview-v1"), phase: "complete", updatedAt: 4000, completedAt: 4000, nextReviewAt: DAY + 4000,
    attempts: [first, tutorAttempt({ id: "retry", text: "I've worked with React since 2021.", createdAt: 3000, supportUsed: true, feedback: { ...tutorAttempt().feedback, skill: signal } })],
    exposures: [{ id: "feedback1", kind: "feedback", at: 2500 }, { id: "feedback2", kind: "feedback", at: 3500 }] });
  const followup = tutorSession({ id: "followup", skill: { ...skill }, parentSessionId: origin.id, task: tutorScenarioFor("duration-remote-v1"), phase: "complete", createdAt: DAY + 4000, updatedAt: DAY + 5000, completedAt: DAY + 5000,
    attempts: [tutorAttempt({ id: "remote", text: "I've been working remotely for two years. I like my home office.", createdAt: DAY + 4500, feedback: { ...tutorAttempt().feedback, skill: signal } })],
    exposures: [{ id: "feedback3", kind: "feedback", at: DAY + 4800 }] });
  return [origin, followup];
}
