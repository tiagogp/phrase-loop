"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getLearningProfile } from "@/features/settings/learningProfile";
import { tutorRecommendation } from "../model";
import { useTutorMemory } from "../useTutorMemory";

export function TutorHomeCard({ onOpen }: { onOpen: () => void }) {
  const { memory, error, refresh } = useTutorMemory();
  const recommendation = memory ? tutorRecommendation(memory.sessions, memory.preferences, getLearningProfile(), memory.loadedAt) : null;
  return <Card className="border-accent/30 bg-accent/5 p-5 sm:p-7">
    <p className="text-xs font-semibold uppercase tracking-wider text-accent">Seu tutor de inglês</p>
    <h2 className="mt-3 text-2xl font-semibold text-ink">{recommendation?.focus ?? "Uma conversa que vira aprendizado"}</h2>
    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">{error ?? recommendation?.reason ?? "Carregando seu histórico…"}</p>
    <div className="mt-5 flex flex-wrap gap-3">
      <Button disabled={!recommendation} onClick={onOpen}>{recommendation?.active ? "Continuar com meu tutor" : recommendation?.due ? "Retomar com meu tutor" : "Praticar com meu tutor"}<span aria-hidden>→</span></Button>
      {error && <Button variant="secondary" onClick={() => void refresh()}>Tentar carregar de novo</Button>}
    </div>
    <p className="mt-3 text-xs text-ink-muted">Uma situação, sua resposta, feedback e outra tentativa. Você pode trocar o foco.</p>
  </Card>;
}
