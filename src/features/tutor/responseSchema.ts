import type { CompletionOptions } from "@/lib/cards/provider";
import { TUTOR_CONCEPTS } from "./catalog";
import type { TutorRequest } from "./types";

const text = (maxLength: number, minLength = 1) => ({ type: "string", minLength, maxLength });
const object = (properties: Record<string, unknown>) => ({
  type: "object", properties, required: Object.keys(properties), additionalProperties: false,
});

/** Constrain generation as well as validating afterwards, including every retry. */
export function tutorResponseSchema(input: TutorRequest): NonNullable<CompletionOptions["responseSchema"]> {
  let schema: Record<string, unknown>;
  if (input.action === "plan") {
    schema = object({ goal: text(180), situation: text(800), instruction: text(800), successCriteria: text(500) });
  } else if (input.action === "help") {
    schema = object({ answer: text(2400) });
  } else {
    schema = object({
      status: { type: "string", enum: ["met", "partial", "not_met", "uncertain"] },
      feedback: text(1200),
      points: { type: "array", maxItems: 2, items: object({ original: text(500), revised: text(500), explanation: text(800) }) },
      example: object({ english: text(500), meaning: text(500) }),
      retryInstruction: text(600),
      skill: object({
        label: text(120),
        conceptId: { type: "string", enum: input.context.targetConceptId
          ? [input.context.targetConceptId] : [...Object.keys(TUTOR_CONCEPTS), "unclassified"] },
        evidence: text(500, 0),
        result: { type: "string", enum: ["demonstrated", "needs_work", "uncertain"] },
      }),
    });
  }
  return { name: `tutor_${input.action}`, schema };
}
