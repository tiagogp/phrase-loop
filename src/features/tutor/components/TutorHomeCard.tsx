"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getLearningProfile } from "@/features/settings/learningProfile";
import { useAiSettings } from "@/features/settings/context/AiSettingsContext";
import { tutorRecommendation } from "../model";
import { useTutorMemory } from "../useTutorMemory";

export function TutorHomeCard({ onOpen, onSettings }: { onOpen: () => void; onSettings: () => void }) {
  const { memory, error, refresh } = useTutorMemory();
  const { settings, loading } = useAiSettings();
  const recommendation = memory ? tutorRecommendation(memory.sessions, memory.preferences, getLearningProfile(), memory.loadedAt) : null;
  const providerReady = settings.providers.some(provider => provider.available);
  const resume = !!recommendation?.active;
  const returnDue = !!recommendation?.due;
  const highlighted = resume || returnDue;
  // A saved session remains accessible even while its provider is offline.
  const needsSetup = !loading && !providerReady && !resume;
  return <Card className={`p-5 ${highlighted ? "border-accent/30 bg-accent/5 sm:p-6" : "border-line"}`}>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1 basis-72">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">{resume ? "Continue de onde parou" : returnDue ? "Hora de retomar com seu tutor" : "Pratique também com seu tutor"}</p>
        <h2 className={`mt-2 font-semibold text-ink ${highlighted ? "text-xl" : "text-base"}`}>{recommendation?.focus ?? "Uma situação real, com feedback para você"}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">{error ?? (needsSetup ? "Conecte uma IA para receber uma situação, feedback e outra tentativa. Seu ciclo diário já está disponível acima." : recommendation?.reason ?? "Carregando seu histórico…")}</p>
      </div>
      <div className="flex flex-wrap gap-2 sm:self-center">
        <Button variant={highlighted ? "primary" : "secondary"} disabled={loading || (!recommendation && !needsSetup)} onClick={needsSetup ? onSettings : onOpen}>{needsSetup ? "Conectar IA para usar o tutor" : resume ? "Continuar sessão" : returnDue ? "Retomar objetivo" : "Praticar com meu tutor"}<span aria-hidden>→</span></Button>
        {error && <Button variant="ghost" onClick={() => void refresh()}>Tentar carregar de novo</Button>}
      </div>
    </div>
  </Card>;
}
