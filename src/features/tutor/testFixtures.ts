import { TUTOR_PROMPT_VERSION, type TutorAttempt, type TutorSession } from "./types";

export function tutorSession(overrides: Partial<TutorSession> = {}): TutorSession {
  return { id: "session-1", revision: 1, phase: "practice", level: "A2", minutes: 5, explanationLanguage: "pt",
    task: { goal: "Remarcar um compromisso", situation: "Sua consulta é na terça, mas você só pode na sexta.", instruction: "Peça para mudar o dia da consulta.", successCriteria: "Pedir uma mudança e indicar sexta-feira." },
    reason: "Você escolheu este objetivo.", evidence: [], draft: "", supportUsed: false, attempts: [], help: [], createdAt: 1000, updatedAt: 1000, ...overrides };
}

export function tutorAttempt(overrides: Partial<TutorAttempt> = {}): TutorAttempt {
  return { id: "attempt-1", text: "I'd like to change my appointment to Friday.", supportUsed: false, createdAt: 2000,
    feedback: { status: "met", feedback: "Você pediu a mudança e indicou o dia.", points: [], example: { english: "Could I move my appointment to Friday?", meaning: "Eu poderia mudar minha consulta para sexta-feira?" }, retryInstruction: "Faça o mesmo pedido com suas palavras." },
    judge: { by: "model", provider: "ollama", model: "test-model", promptVersion: TUTOR_PROMPT_VERSION }, ...overrides };
}
