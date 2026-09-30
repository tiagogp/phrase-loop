"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { feedbackLabels } from "../model";
import { useTutorMemory } from "../useTutorMemory";

export function TutorProgressCard({ onOpen }: { onOpen: () => void }) {
  const { memory, error, refresh } = useTutorMemory();
  const latest = memory?.sessions.find(s => s.attempts.length > 0);
  if (error) return <Card className="p-5"><p className="text-sm text-ink-soft">Não foi possível carregar suas sessões do tutor.</p><Button variant="ghost" onClick={() => void refresh()}>Tentar novamente</Button></Card>;
  if (!latest) return null;
  const first = latest.attempts[0];
  const last = latest.attempts.at(-1)!;
  const samples = first.id === last.id ? [first] : [first, last];
  return <Card className="space-y-4 p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold text-ink">Na sua prática com o tutor</h2><Button variant="ghost" size="sm" onClick={onOpen}>Ver minhas sessões →</Button></div>
    <p className="text-sm text-ink-soft">{latest.task.goal} · {new Date(latest.createdAt).toLocaleDateString("pt-BR")}</p>
    <div className={`grid gap-3 ${samples.length > 1 ? "sm:grid-cols-2" : ""}`}>
      {samples.map((attempt, i) => <div key={attempt.id} className="rounded border border-line p-4">
        <p className="text-xs font-medium text-accent">{i === 0 ? "Primeira tentativa" : "Após o feedback"} · {attempt.supportUsed ? "com apoio" : "sem pedir apoio"}</p>
        <blockquote className="mt-2 text-sm text-ink" lang="en">{attempt.text}</blockquote>
        <p className="mt-3 text-xs text-ink-muted">{attempt.disputed ? "Avaliação contestada" : feedbackLabels[attempt.feedback.status]} · IA: {attempt.judge.provider}{attempt.judge.model ? ` / ${attempt.judge.model}` : ""}</p>
      </div>)}
    </div>
    <p className="text-xs leading-relaxed text-ink-muted">Estas respostas mostram o que aconteceu nesta tarefa. Uma nova tentativa após feedback tem apoio; a retomada em outro dia observará a recuperação.</p>
  </Card>;
}
