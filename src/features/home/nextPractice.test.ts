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

import { extraPractice } from "./nextPractice";
import { DAY, durationHistory, tutorSession } from "@/features/tutor/testFixtures";
it("caps optional launches at two per local day, including unfinished extras", () => {
  const now = 10 * DAY;
  const extras = [1, 2].map(i => tutorSession({ id: `extra-${i}`, extraPractice: true, createdAt: now }));
  expect(extraPractice(extras.slice(0, 1), now)?.remaining).toBe(1);
  expect(extraPractice(extras, now)).toBeUndefined();
  expect(extraPractice(extras, now + DAY)?.remaining).toBe(2);
});
it("offers new practice without selecting a recently exposed skill or consuming a reminder", () => {
  const history = durationHistory();
  const snapshot = JSON.stringify(history);
  const extra = extraPractice(history, DAY + 6000)!;
  expect(extra.conceptId).not.toBe("present-perfect-duration");
  expect(extra.task.scenarioId).not.toBe(history[1].task.scenarioId);
  expect(JSON.stringify(history)).toBe(snapshot);
  expect(nextPractice({ ...base, completedToday: true, tutorDue: true, hasAi: true })).toBe("complete");
});
