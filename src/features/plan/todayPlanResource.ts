import { createSharedResource } from "@/lib/store/sharedResource";
import { isStoreAvailable } from "@/lib/store/db";
import { getActivitySince, type ActivityEvent } from "@/lib/store/activityLog";
import type { DailyTask, LearningPlan } from "./schema";
import { getActivePlan, getTodayTasks, updateDayTask } from "./store";
import { countTaskEvidence, taskEvidenceMeetsTarget } from "./evidence";

interface PlanSnapshot {
  plan: LearningPlan | null;
  today: DailyTask | null;
}

// Today prepares this once. Opening the plan consumes the same snapshot instead
// of replacing the screen with a new loading state and repeating these reads.
export const todayPlanResource = createSharedResource<PlanSnapshot>({ plan: null, today: null }, async () => {
  if (!isStoreAvailable()) return { plan: null, today: null };
  const plan = await getActivePlan();
  let today = plan ? await getTodayTasks(plan.id) : null;
  if (plan && today) {
    const dayStart = new Date(`${today.date}T00:00:00`).getTime();
    const events = await getActivitySince(dayStart).catch(() => [] as ActivityEvent[]);
    for (const task of today.tasks) {
      if (task.completedAt != null || !taskEvidenceMeetsTarget(task, events)) continue;
      const now = Date.now();
      await updateDayTask(plan.id, today.date, task.id, now, { at: now, count: countTaskEvidence(task, events) });
    }
    today = await getTodayTasks(plan.id);
  }
  return { plan, today };
}, ["phraseloop:plan-updated", "phraseloop:activity", "phraseloop:backup-restored"]);
