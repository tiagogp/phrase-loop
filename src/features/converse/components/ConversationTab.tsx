"use client";

import { useState, useSyncExternalStore } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useT } from "@/i18n/I18nProvider";
import ConverseTab from "@/features/converse/components/ConverseTab";
import { ADVANCED_CONVERSATION_SCENARIOS } from "@/features/converse/constants";
import { useProviderSelection } from "@/features/cards/hooks/useProviderSelection";
import { useAiSettings } from "@/features/settings/context/AiSettingsContext";
import { DEFAULT_LEARNING_PROFILE, getLearningProfile, subscribeToProfile } from "@/features/settings/learningProfile";
import { GuidedSpeaking } from "@/features/pronunciation/components/GuidedSpeaking";

/** Conversation is discoverable at every level; unavailable AI has a useful local alternative. */
export default function ConversationTab({ onOpenSettings, active = true }: { onOpenSettings?: () => void; active?: boolean }) {
  const { t } = useT();
  const { hasEvaluator } = useProviderSelection({ fallbackToEvaluator: true });
  const { loading } = useAiSettings();
  const [guided, setGuided] = useState(false);
  const level = useSyncExternalStore(subscribeToProfile, () => getLearningProfile().level, () => DEFAULT_LEARNING_PROFILE.level);
  const advanced = level === "C1" || level === "C2";
  return (
    <div className="space-y-5">
      <PageHeader title={t("Conversation")}
        description={t("Practice a real situation. Keep a useful expression, improve one answer, and bring it into your next review.")} />
      {guided ? <>
        <Button variant="ghost" onClick={() => setGuided(false)}>{t("Back to conversation")}</Button>
        <GuidedSpeaking active={active} onDone={() => setGuided(false)} />
      </> : loading ? <p role="status" className="text-sm text-ink-muted">{t("Loading…")}</p>
        : hasEvaluator ? <>
          <ConverseTab active={active} onOpenSettings={onOpenSettings}
            scenarios={advanced ? ADVANCED_CONVERSATION_SCENARIOS : undefined}
            topicFirst={advanced} defaultFreeTalk={advanced} />
          <Button variant="ghost" onClick={() => setGuided(true)}>{t("Warm up with guided speaking")}</Button>
        </> : <Card className="space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold text-ink">{t("Choose how to start speaking")}</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">{t("Connect an AI for a conversation partner that responds to you. You can also rehearse a phrase and make your own answer with guided practice.")}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" onClick={() => setGuided(true)}>{t("Start guided speaking")}</Button>
            {onOpenSettings && <Button variant="secondary" onClick={onOpenSettings}>{t("Connect an AI")}</Button>}
          </div>
        </Card>}
    </div>
  );
}
