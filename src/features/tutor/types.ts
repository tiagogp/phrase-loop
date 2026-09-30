import type { EnglishLevel } from "@/features/discover/types";
import type { ProviderKind } from "@/lib/cards/provider";
import type { JudgeStamp } from "@/lib/evaluation/judge";

export const TUTOR_PROMPT_VERSION = "tutor-2026-09-29";
export const MAX_TUTOR_ATTEMPTS = 3;

export interface TutorTask {
  goal: string;
  situation: string;
  instruction: string;
  successCriteria: string;
}

export interface TutorFeedback {
  status: "met" | "partial" | "not_met" | "uncertain";
  feedback: string;
  /** Focused teaching points, not an exhaustive error count. */
  points: { original: string; revised: string; explanation: string }[];
  example: { english: string; meaning: string };
  retryInstruction: string;
}

export interface TutorObservation {
  id: string;
  kind: "production" | "review" | "phrase" | "tutor";
  label: string;
  text: string;
  detail: string;
  createdAt: number;
  supported: boolean | null;
}

export interface TutorPreferences {
  id: "preferences";
  goal: string;
  explanationLanguage: "pt" | "en";
  ignoredEvidenceIds: string[];
}

export interface TutorAttempt {
  id: string;
  text: string;
  supportUsed: boolean;
  createdAt: number;
  feedback: TutorFeedback;
  judge: JudgeStamp;
  disputed?: boolean;
}

export interface TutorSession {
  id: string;
  provider?: ProviderKind;
  model?: string;
  revision: number;
  phase: "practice" | "feedback" | "complete";
  level: EnglishLevel;
  minutes: 5 | 10 | 20;
  explanationLanguage: "pt" | "en";
  task: TutorTask;
  reason: string;
  evidence: TutorObservation[];
  parentSessionId?: string;
  draft: string;
  supportUsed: boolean;
  attempts: TutorAttempt[];
  help: { question: string; answer: string; createdAt: number }[];
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  nextReviewAt?: number;
  /** A follow-up only consumes its parent's reminder after an actual attempt. */
  revisitedAt?: number;
  savedPhraseId?: string;
}

export interface TutorContext {
  level: EnglishLevel;
  minutes: 5 | 10 | 20;
  explanationLanguage: "pt" | "en";
  focus: string;
  evidence: TutorObservation[];
  previousTask?: TutorTask;
}

export type TutorRequest = {
  provider: ProviderKind;
  ollamaModel?: string;
  context: TutorContext;
} & (
  | { action: "plan" }
  | { action: "evaluate"; task: TutorTask; text: string }
  | { action: "help"; task: TutorTask; question: string; text: string; feedback?: TutorFeedback; history?: { question: string; answer: string }[] }
);

export type TutorResponse =
  | { action: "plan"; task: TutorTask }
  | { action: "evaluate"; feedback: TutorFeedback; judge: JudgeStamp }
  | { action: "help"; answer: string };
