import { describe, expect, it } from "vitest";
import { nextPractice } from "./nextPractice";
import type { TaskItem } from "@/features/plan/schema";

const base = { active: false, completedToday: false, tutorDue: false, hasAi: false, cards: 0, reviewRemaining: 0, reviewedToday: 0 };
const planTask: TaskItem = { id: "task", type: "lesson", instruction: "Learn a phrase" };

describe("one next practice", () => {
  it("starts locally without AI and uses the tutor when available", () => {
    expect(nextPractice(base)).toBe("lesson");
    expect(nextPractice({ ...base, hasAi: true })).toBe("tutor");
  });
  it("resumes active work ahead of competing review and plan suggestions", () => {
    expect(nextPractice({ ...base, active: true, tutorDue: true, reviewRemaining: 30, planTask })).toBe("resume");
  });
  it("gives a completed session a stopping point even with a large backlog", () => {
    expect(nextPractice({ ...base, completedToday: true, hasAi: true, tutorDue: true, reviewRemaining: 200, planTask })).toBe("complete");
  });
  it("uses due skill practice before cards, but provides a working local path offline", () => {
    expect(nextPractice({ ...base, hasAi: true, tutorDue: true, cards: 10, reviewRemaining: 3 })).toBe("revisit");
    expect(nextPractice({ ...base, tutorDue: true, cards: 10, reviewRemaining: 3 })).toBe("review");
  });
  it("finishes the review-to-use flow before introducing a new plan task", () => {
    expect(nextPractice({ ...base, cards: 10, reviewedToday: 3, planTask })).toBe("use");
    expect(nextPractice({ ...base, planTask })).toBe("plan");
  });
});
