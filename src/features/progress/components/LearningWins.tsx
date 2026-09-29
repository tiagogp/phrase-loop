"use client";

import { Card } from "@/components/ui/Card";
import { useT } from "@/i18n/I18nProvider";
import type { LearningWin } from "../learningEvidence";

export function LearningWins({ wins, compact = false }: { wins: LearningWin[]; compact?: boolean }) {
  const { t } = useT();
  return (
    <Card className="space-y-4 p-5 sm:p-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-accent">{t("Evidence from your practice")}</p>
        <h2 className="mt-1 text-lg font-semibold text-ink">{t("Look at what you can do")}</h2>
        <p className="mt-1 text-sm text-ink-muted">{t("Your own answers show the change. Each example belongs to a real attempt.")}</p>
      </div>
      {wins.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-4 text-sm leading-relaxed text-ink-soft">
          {t("Your first example will appear here when you recall a phrase without hints, improve an answer after feedback, or use a pattern in a new situation.")}
        </p>
      ) : (
        <ul className="space-y-3">
          {wins.slice(0, compact ? 1 : 5).map((win) => (
            <li key={`${win.kind}-${win.id}`} className="rounded-lg border border-line bg-surface p-4">
              <p className="text-xs font-medium text-accent">
                {win.kind === "retry" ? t("You improved this answer")
                  : win.kind === "transfer" ? t("You used it in a new situation")
                    : (win.days ?? 0) > 0 ? t("You recalled it after {days} days", { days: win.days! })
                      : t("You recalled it without hints")}
              </p>
              {win.before && <p className="mt-2 text-sm text-ink-muted"><span className="mr-2 font-medium">{t("Before")}</span><span lang="en">{win.before}</span></p>}
              <p className="mt-2 text-base leading-relaxed text-ink" lang="en">“{win.text}”</p>
              <p className="mt-2 text-xs text-ink-muted">
                {new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" }).format(win.at)}
                {win.kind === "retry" ? ` · ${t(win.supported ? "With support" : "After feedback")}` : ` · ${t("Without hints")}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
