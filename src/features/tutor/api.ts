import { isTutorFeedback, isTutorTask } from "./contract";
import type { TutorRequest, TutorResponse } from "./types";

export async function requestTutor(input: TutorRequest, signal: AbortSignal): Promise<TutorResponse> {
  const response = await fetch("/api/tutor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "Não foi possível falar com o tutor. Tente novamente.");
  if ((data?.action === "plan" && isTutorTask(data.task))
    || (data?.action === "evaluate" && isTutorFeedback(data.feedback) && data.judge?.by === "model")
    || (data?.action === "help" && typeof data.answer === "string" && data.answer.trim())) return data;
  throw new Error("A resposta do tutor estava incompleta. Tente novamente.");
}
