/**
 * The three numbers the product owner reads after two weeks of long sessions, derived from local
 * records for the pilot export. They are process measures — whether the loop runs — not
 * proficiency, and the export says so.
 *
 * 1. Share of gaps closed. Denominator: gaps that had a chance to close, i.e. at least one long
 *    session started 24h or more after the gap opened (or already closed). The rest are counted
 *    apart, so a gap opened on the last day does not drag the share down.
 * 2. Portuguese per session: recorded seconds of "travei" stretches, next to the count of stuck
 *    moments (a typed stretch has no duration but is still a stuck moment).
 * 3. Long sessions per week, in 7-day windows from the first one.
 */

import type { Conversation } from "@/lib/store/repository";
import { codeSwitchStats } from "./longSession";
import { GAP_CLOSE_DELAY_MS, partitionOpenGaps, type ConversationGap } from "./gaps";

const WEEK = 7 * 24 * 60 * 60 * 1000;

function spoke(conversation: Conversation): boolean {
  return conversation.turns.some((turn) => turn.role === "user" && turn.text.trim());
}

export function longSessionMetrics(conversations: Conversation[], gaps: ConversationGap[], now: number, includeAnswers = false) {
  const sessions = conversations
    .filter((item) => item.mode === "long" && item.longSession && item.startedAt <= now && spoke(item))
    .sort((a, b) => a.startedAt - b.startedAt);
  const rows = sessions.map((item) => {
    const stats = codeSwitchStats(item.turns);
    return {
      id: item.id,
      startedAt: item.startedAt,
      scenarioId: item.longSession?.scenarioId ?? null,
      durationMinutes: item.longSession!.durationMinutes,
      endedBy: item.longSession?.endedBy ?? null,
      learnerTurns: item.turns.filter((turn) => turn.role === "user").length,
      stuckMoments: stats.count,
      typedPortugueseStretches: stats.typed,
      recordedPortugueseSeconds: stats.recordedSeconds,
      reviewed: Boolean(item.longSession?.review),
      gapsFound: item.longSession?.review?.gaps.length ?? 0,
      gapsClosed: item.longSession?.closedGapIds?.length ?? 0,
    };
  });

  const known = gaps.filter((gap) => gap.firstOpenedAt <= now);
  const hadChance = (gap: ConversationGap) => gap.status === "closed"
    || sessions.some((item) => item.startedAt - gap.openedAt >= GAP_CLOSE_DELAY_MS && !gap.sessionIds.includes(item.id));
  const eligible = known.filter(hadChance);
  const closed = eligible.filter((gap) => gap.status === "closed");

  const first = sessions[0]?.startedAt;
  const weeks = first === undefined ? [] : Array.from({ length: Math.floor((now - first) / WEEK) + 1 }, (_, index) => {
    const start = first + index * WEEK;
    return {
      weekStart: new Date(start).toISOString(),
      sessions: sessions.filter((item) => item.startedAt >= start && item.startedAt < start + WEEK).length,
      complete: now >= start + WEEK,
    };
  });

  const { active, frozen } = partitionOpenGaps(known);
  return {
    measures: "process measures, not proficiency or learning outcomes",
    sessions: rows,
    sessionsPerWeek: weeks,
    portuguesePerSession: rows.map((row) => ({ startedAt: row.startedAt, recordedSeconds: row.recordedPortugueseSeconds, stuckMoments: row.stuckMoments })),
    gaps: {
      total: known.length,
      eligible: eligible.length,
      closed: closed.length,
      closedShare: eligible.length > 0 ? closed.length / eligible.length : null,
      notYetEligible: known.length - eligible.length,
      open: active.length + frozen.length,
      frozen: frozen.length,
      reopened: known.filter((gap) => gap.reopenCount > 0).length,
      byPattern: Object.fromEntries(known.map((gap) => [gap.patternLabel, { status: gap.status, occurrences: gap.occurrences, reopenCount: gap.reopenCount }])),
    },
    definitions: {
      closedShare: "closed gaps / gaps with at least one later long session started 24h+ after opening (or already closed)",
      portuguese: "recorded seconds of held-button Portuguese; typed stretches count as stuck moments without seconds",
      sessionsPerWeek: "long sessions with at least one learner turn, in 7-day windows from the first one; the last window may be incomplete",
    },
    ...(includeAnswers ? { gapEvidence: known.map((gap) => ({ patternLabel: gap.patternLabel, evidence: gap.evidence })) } : {}),
  };
}
