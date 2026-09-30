import type { TutorSession, TutorTask } from "./types";

/** Small authored vocabulary. Unknown concepts remain episode-local, never guessed from labels. */
export const TUTOR_CONCEPTS = {
  "present-perfect-duration": { label: "Falar sobre duração com present perfect", rubric: "Express an action or state that started in the past and continues now, with a valid present perfect form and duration/start point. Accept simple or continuous forms when natural. A past-only event or avoidance of duration does not demonstrate this skill." },
  "polite-requests": { label: "Fazer pedidos com educação", rubric: "Make a clear, appropriately polite request using a valid request construction. Accept natural alternatives; do not require a particular modal." },
} as const;
export type TutorConceptId = keyof typeof TUTOR_CONCEPTS;
export function isTutorConceptId(value: unknown): value is TutorConceptId {
  return typeof value === "string" && Object.hasOwn(TUTOR_CONCEPTS, value);
}

const scenarios: { conceptId: TutorConceptId; contextId: string; task: TutorTask }[] = [
  { conceptId: "present-perfect-duration", contextId: "professional-experience", task: { scenarioId: "duration-interview-v1", goal: "Contar sua experiência profissional", situation: "Você está em uma entrevista. Conte sobre uma tecnologia que usa no trabalho e há quanto tempo a utiliza.", instruction: "Tell me about your professional experience. Include how long you have used a technology you still work with.", successCriteria: "Descrever uma experiência que continua no presente e sua duração ou data de início." } },
  { conceptId: "present-perfect-duration", contextId: "remote-work", task: { scenarioId: "duration-remote-v1", goal: "Conversar sobre trabalho remoto", situation: "Um colega novo quer conhecer sua rotina. Conte há quanto tempo trabalha remotamente e um aspecto dessa experiência.", instruction: "Tell your new colleague about working remotely. Include when you started or how long you have done it.", successCriteria: "Comunicar a duração de uma experiência de trabalho remoto que continua no presente." } },
  { conceptId: "present-perfect-duration", contextId: "learning-technology", task: { scenarioId: "duration-learning-v1", goal: "Contar o que está estudando", situation: "Você participa de um encontro de tecnologia. Conte sobre algo que começou a estudar e continua estudando, incluindo há quanto tempo.", instruction: "Tell someone about a technology you are learning. Include when you started or how long you have studied it.", successCriteria: "Comunicar a duração de um estudo iniciado no passado e ainda em andamento." } },
  { conceptId: "present-perfect-duration", contextId: "living-in-city", task: { scenarioId: "duration-city-v1", goal: "Apresentar sua vida na cidade", situation: "Um visitante pergunta sobre a cidade onde você mora. Conte há quanto tempo vive nela e algo de que gosta.", instruction: "Tell a visitor about living in your city. Include when you moved there or how long it has been your home.", successCriteria: "Expressar há quanto tempo mora na cidade e compartilhar uma informação relevante." } },
  { conceptId: "polite-requests", contextId: "reschedule-meeting", task: { scenarioId: "request-meeting-v1", goal: "Remarcar uma reunião", situation: "Você não pode participar da reunião de terça-feira. Peça a um colega para mudar para sexta-feira.", instruction: "Ask your colleague to move Tuesday's meeting to Friday.", successCriteria: "Pedir a mudança de forma clara e educada, indicando a nova data." } },
  { conceptId: "polite-requests", contextId: "code-review", task: { scenarioId: "request-review-v1", goal: "Pedir uma revisão de código", situation: "Você terminou uma mudança e precisa de uma revisão antes do fim do dia. Faça o pedido a alguém da equipe.", instruction: "Ask a teammate to review your code before the end of the day.", successCriteria: "Pedir a revisão com educação e informar o prazo." } },
  { conceptId: "polite-requests", contextId: "recruiter-details", task: { scenarioId: "request-recruiter-v1", goal: "Pedir informações a um recrutador", situation: "Um recrutador enviou uma vaga sem detalhes sobre o horário. Peça essa informação.", instruction: "Ask the recruiter for information about the working hours.", successCriteria: "Fazer um pedido educado e específico sobre o horário." } },
];

export function verifiedTutorContext(task: TutorTask, conceptId?: string): string | undefined {
  const scenario = scenarios.find(s => s.conceptId === conceptId && s.task.scenarioId === task.scenarioId);
  // An ID supplied by a model or a restored backup alone is not verification.
  return scenario && (["goal", "situation", "instruction", "successCriteria"] as const).every(k => scenario.task[k] === task[k]) ? scenario.contextId : undefined;
}

export function chooseTutorScenario(conceptId: string, sessions: TutorSession[]): TutorTask | undefined {
  const options = scenarios.filter(s => s.conceptId === conceptId);
  const lastUse = (id: string) => Math.max(0, ...sessions.filter(s => s.task.scenarioId === id).map(s => s.createdAt));
  const next = [...options].sort((a, b) => lastUse(a.task.scenarioId!) - lastUse(b.task.scenarioId!))[0];
  return next ? { ...next.task } : undefined;
}

export const tutorScenarioFor = (id: string): TutorTask => {
  const task = scenarios.find(s => s.task.scenarioId === id)?.task;
  if (!task) throw new Error("Situação desconhecida.");
  return { ...task };
};
