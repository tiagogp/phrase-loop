import { describe, expect, it } from "vitest";
import {
  codeSwitchStats,
  codeSwitchTurn,
  endDisposition,
  formatRemaining,
  isLongSessionLevel,
  isTimeUp,
  newExpressionBudget,
  pauseClock,
  pendingCodeSwitch,
  recordIntroduced,
  remainingMs,
  resumeClock,
  startClock,
  timeUpAction,
} from "./longSession";

const MIN = 60_000;

describe("long session clock", () => {
  it("counts down from the chosen duration and ends on time", () => {
    const clock = startClock(5, 0);
    expect(remainingMs(clock, 2 * MIN)).toBe(3 * MIN);
    expect(formatRemaining(remainingMs(clock, 2 * MIN + 13_000))).toBe("2:47");
    expect(isTimeUp(clock, 5 * MIN - 1)).toBe(false);
    expect(isTimeUp(clock, 5 * MIN)).toBe(true);
  });

  it("keeps the session while paused and resumes from the same point", () => {
    const paused = pauseClock(startClock(10, 0), 4 * MIN);
    expect(remainingMs(paused, 60 * MIN)).toBe(6 * MIN);
    const resumed = resumeClock(paused, 60 * MIN);
    expect(remainingMs(resumed, 61 * MIN)).toBe(5 * MIN);
    expect(isTimeUp(resumed, 66 * MIN)).toBe(true);
  });

  it("lets the current turn finish when time runs out, then goes to review", () => {
    expect(timeUpAction({ timeUp: false, turnInProgress: true })).toBe("continue");
    expect(timeUpAction({ timeUp: true, turnInProgress: true })).toBe("wait_for_turn");
    expect(timeUpAction({ timeUp: true, turnInProgress: false })).toBe("review");
  });

  it("ends without review when the learner never spoke", () => {
    expect(endDisposition([{ role: "assistant", text: "Hi! What did you work on yesterday?" }])).toBe("discard");
    expect(endDisposition([{ role: "assistant", text: "Hi!" }, { role: "user", text: "Well, I fixed the build." }])).toBe("review");
  });

  it("is offered from B1 up", () => {
    expect(isLongSessionLevel("A2")).toBe(false);
    expect(isLongSessionLevel("B1")).toBe(true);
    expect(isLongSessionLevel("c2")).toBe(true);
  });
});

describe("travei stretches", () => {
  const turns = [
    { role: "assistant" as const, text: "Can we ship on Friday?" },
    { role: "user" as const, text: "eu acho que a gente precisa adiar", codeSwitch: true, codeSwitchInput: "voice" as const, durationMs: 3_400, at: 10 },
    { role: "assistant" as const, text: "So you'd rather push it back a week?" },
    { role: "user" as const, text: "não sei dizer prazo apertado", codeSwitch: true, codeSwitchInput: "typed" as const, at: 20 },
  ];

  it("counts every stuck moment but only recorded Portuguese in the seconds", () => {
    expect(codeSwitchStats(turns)).toEqual({ count: 2, recordedSeconds: 3, typed: 1 });
  });

  it("marks a held-button stretch with its text, moment and length, and a typed one without length", () => {
    expect(codeSwitchTurn(" a gente precisa adiar ", "voice", 50, 2_499.6)).toEqual({
      role: "user", text: "a gente precisa adiar", codeSwitch: true, codeSwitchInput: "voice", at: 50, durationMs: 2_500, spoken: true,
    });
    const typed = codeSwitchTurn("prazo apertado", "typed", 60, 9_000);
    expect(typed).not.toHaveProperty("durationMs");
    expect(codeSwitchStats([typed])).toEqual({ count: 1, recordedSeconds: 0, typed: 1 });
  });

  it("hands the last Portuguese stretch to the next reply only", () => {
    expect(pendingCodeSwitch(turns)).toBe("não sei dizer prazo apertado");
    expect(pendingCodeSwitch(turns.slice(0, 3))).toBeUndefined();
  });
});

describe("B1/B2 new expressions", () => {
  it("never introduces on the opening turn or while a gap is waiting", () => {
    expect(newExpressionBudget({ nextAiTurn: 0, pacing: { introduced: 0 }, gapPending: false })).toBe(0);
    expect(newExpressionBudget({ nextAiTurn: 2, pacing: { introduced: 0 }, gapPending: true })).toBe(0);
  });

  it("allows up to 2 every 4 AI turns and at most 3 per session", () => {
    let pacing = { introduced: 0 } as { introduced: number; lastIntroAiTurn?: number };
    const first = newExpressionBudget({ nextAiTurn: 1, pacing, gapPending: false });
    expect(first).toBe(2);
    pacing = recordIntroduced(pacing, 1, 2, first);
    expect(newExpressionBudget({ nextAiTurn: 4, pacing, gapPending: false })).toBe(0);
    const second = newExpressionBudget({ nextAiTurn: 5, pacing, gapPending: false });
    expect(second).toBe(1);
    pacing = recordIntroduced(pacing, 5, 3, second);
    expect(pacing.introduced).toBe(3);
    expect(newExpressionBudget({ nextAiTurn: 20, pacing, gapPending: false })).toBe(0);
  });
});
