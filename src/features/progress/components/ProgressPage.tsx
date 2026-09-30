"use client";

import Disclosure from "@/components/ui/Disclosure";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { useT } from "@/i18n/I18nProvider";
import { useLearningEvidence } from "../useLearningEvidence";
import type { EvidenceRate } from "../learningEvidence";
import { LearningWins } from "./LearningWins";
import { ProgressOverview } from "./ProgressOverview";
import { TutorProgressCard } from "@/features/tutor/components/TutorProgressCard";

export default function ProgressPage({ onPractice, onTutor, active = true }: { onPractice: () => void; onTutor?: () => void; active?: boolean }) {
  const { t } = useT();
  const { evidence, loading, error, refresh } = useLearningEvidence();
  const [details, setDetails] = useState(false);
  return (
    <div className="space-y-5">
      <PageHeader eyebrow={t("Your learning, made visible")} title={t("Progress")}
        description={t("What you achieved with support, recalled independently, and used in another situation.")}
        aside={<Button variant="secondary" onClick={onTutor ?? onPractice}>{t("Keep practicing")}</Button>} />
      {active && <TutorProgressCard onOpen={onTutor ?? onPractice} />}
      <Disclosure title={t("Reviews and extra exercises · last 30 days")} contentClassName="space-y-4">
      {loading ? <p role="status" className="text-sm text-ink-muted">{t("Loading progress…")}</p>
        : error ? <Notice tone="error">{t("Could not load your practice history.")} <Button variant="ghost" onClick={() => void refresh()}>{t("Try again")}</Button></Notice>
          : <>
            <LearningWins wins={evidence.wins} />
            <div className="grid gap-3 sm:grid-cols-3">
              <EvidenceStat label={t("Recall without hints")} value={evidence.recall} detail={t("Answers checked before you revealed the phrase.")} />
              <EvidenceStat label={t("Remembered later")} value={evidence.retention} detail={t("Separate checks after 7, 30, or 60 days.")} />
              <EvidenceStat label={t("Used somewhere new")} value={evidence.transfer} detail={t("Checked uses of a pattern in a new situation, without hints.")} />
            </div>
            <Card className="p-5">
              <h2 className="font-semibold text-ink">{t("This week and last week")}</h2>
              {evidence.comparison.delta === null ? <p className="mt-2 text-sm text-ink-muted">{t("Practice the same phrases across different days. A comparison appears when at least 5 phrases have checked answers in both weeks.")}</p>
                : <>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">{evidence.comparison.previous.percent}% <span aria-hidden="true">→</span> {evidence.comparison.current.percent}%</p>
                  <p className="mt-1 text-sm text-ink-muted">{t("Without hints, on {count} phrases practiced in both weeks. Different practice conditions can affect the result.", { count: evidence.comparison.cards })}</p>
                </>}
            </Card>
          </>}

      <Button variant="ghost" onClick={() => setDetails(!details)} aria-expanded={details} aria-controls="progress-details">
        {t(details ? "Hide detailed stats" : "Show detailed stats")}
      </Button>
      {details && <div id="progress-details"><ProgressOverview showCheckIn /></div>}
      </Disclosure>
    </div>
  );
}

function EvidenceStat({ label, value, detail }: { label: string; value: EvidenceRate; detail: string }) {
  const { t } = useT();
  return <Card className="space-y-2 p-5">
    <h2 className="text-sm font-medium text-ink">{label}</h2>
    <p className="text-3xl font-semibold tabular-nums text-ink">{value.percent === null ? "—" : `${value.percent}%`}</p>
    <p className="text-xs text-ink-soft">{value.total ? t("{correct} of {total} checked attempts", { correct: value.correct, total: value.total }) : t("Not measured yet")}</p>
    <p className="text-xs leading-relaxed text-ink-muted">{detail}</p>
  </Card>;
}
