"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { DailyTask, LearningPlan } from "../schema";
import { updateDayTask } from "../store";
import { todayPlanResource as resource } from "../todayPlanResource";
import { dateString } from "../utils";

export interface TodayPlanState {
  loading: boolean;
  error: boolean;
  plan: LearningPlan | null;
  today: DailyTask | null;
  /** True when a plan exists but its last day has already passed. */
  isPlanConcluded: boolean;
  completeTask: (taskId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useTodayPlan(): TodayPlanState {
  const { data: { plan, today }, loading, error, now } = useSyncExternalStore(resource.subscribe, resource.getSnapshot, resource.getServerSnapshot);
  const currentDate = now ? dateString(new Date(now)) : null;
  const previousDate = useRef(currentDate);
  useEffect(() => {
    const changedDay = previousDate.current !== null && previousDate.current !== currentDate;
    previousDate.current = currentDate;
    if (changedDay) void resource.refresh();
  }, [currentDate]);

  const completeTask = useCallback(async (taskId: string) => {
    if (!plan || !today) return;
    await updateDayTask(plan.id, today.date, taskId, Date.now());
    await resource.refresh();
  }, [plan, today]);

  const isPlanConcluded =
    currentDate != null &&
    plan != null &&
    today == null &&
    plan.days.length > 0 &&
    plan.days[plan.days.length - 1].date < currentDate;

  return { loading, error: Boolean(error), plan, today, isPlanConcluded, completeTask, refresh: resource.refresh };
}
