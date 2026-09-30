"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProviderPicker } from "@/features/cards/components/ProviderPicker";
import { useProviderSelection } from "@/features/cards/hooks/useProviderSelection";
import { getLearningProfile } from "@/features/settings/learningProfile";
import { ENGLISH_LEVELS } from "@/features/discover/constants";
import type { EnglishLevel } from "@/features/discover/types";
import { createTutorSession, selectTutorEvidence, tutorRecommendation } from "../model";
import { saveTutorPreferences, type TutorMemory } from "../store";
import type { TutorSession } from "../types";
import { useTutorMemory } from "../useTutorMemory";
import { useTutorSession } from "../useTutorSession";
import { TutorMemoryPanel, tutorInputClass } from "./TutorMemoryPanel";
import { TutorPractice } from "./TutorPractice";

export interface TutorWorkspaceProps {
  onBack: () => void;
  onSettings: () => void;
  onPractice: () => void;
  onConversation: () => void;
  onContent: () => void;
  onTools: () => void;
}

export default function TutorWorkspace(props: TutorWorkspaceProps) {
  const { memory, error, refresh } = useTutorMemory();
  if (error) return <Notice tone="error">{error}<Button variant="secondary" onClick={() => void refresh()}>Tentar novamente</Button><Button variant="ghost" onClick={props.onBack}>Voltar</Button></Notice>;
  if (!memory) return <p role="status" className="text-sm text-ink-muted">Carregando seu tutor…</p>;
  return <TutorBody memory={memory} {...props} />;
}

function TutorBody({ memory, ...props }: TutorWorkspaceProps & { memory: TutorMemory }) {
  const [selected, setSelected] = useState<TutorSession | null>(() => tutorRecommendation(memory.sessions, memory.preferences, getLearningProfile(), Date.now()).active ?? null);
  const [showMemory, setShowMemory] = useState(false);
  const [memoryViewed, setMemoryViewed] = useState(false);
  return <div className="space-y-6">
    {selected ? <TutorPractice key={selected.id} initial={selected} memory={memory} {...props} onNew={() => setSelected(null)} /> : <>
      <Button variant="ghost" onClick={props.onBack}>← Voltar</Button>
      <PageHeader eyebrow="Inglês para uma situação real" title="Seu tutor" description="Tente com suas palavras. Entenda o ajuste. Volte depois para ver o que ficou." />
      <TutorSetup key={memory.preferences.goal + memory.preferences.explanationLanguage} memory={memory} memoryViewed={memoryViewed} onOpen={setSelected} {...props} />
      <Button variant="ghost" aria-expanded={showMemory} aria-controls="tutor-memory" onClick={() => { setMemoryViewed(true); setShowMemory(!showMemory); }}>O que meu tutor lembra</Button>
      {showMemory && <div id="tutor-memory"><TutorMemoryPanel memory={memory} /></div>}
      {memory.sessions.length > 0 && <section className="space-y-3" aria-label="Sessões do tutor">
        <h2 className="font-semibold text-ink">Suas sessões</h2>
        {memory.sessions.slice(0, 8).map(session => <button key={session.id} className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-card p-4 text-left hover:border-accent/40" onClick={() => setSelected(session)}>
          <span className="text-sm font-medium text-ink">{session.task.goal}</span><span className="text-xs text-ink-muted">{new Date(session.createdAt).toLocaleDateString("pt-BR")} · {session.phase === "complete" ? `${session.attempts.length} respostas · ver resumo` : "Continuar"} →</span>
        </button>)}
      </section>}
    </>}
  </div>;
}

function TutorSetup({ memory, memoryViewed, onOpen, onSettings, onPractice, onContent }: TutorWorkspaceProps & { memory: TutorMemory; memoryViewed: boolean; onOpen: (session: TutorSession) => void }) {
  const profile = getLearningProfile();
  const recommendation = tutorRecommendation(memory.sessions, memory.preferences, profile, memory.loadedAt);
  const [focus, setFocus] = useState(recommendation.focus);
  const [level, setLevel] = useState<EnglishLevel>(profile.level);
  const [minutes, setMinutes] = useState<5 | 10 | 20>(profile.dailyMinutes === 5 || profile.dailyMinutes === 20 ? profile.dailyMinutes : 10);
  const [sourceId, setSourceId] = useState("");
  const selection = useProviderSelection({ fallbackToEvaluator: true });
  const controller = useTutorSession(null);
  const cards = memory.cards.filter(c => c.direction !== "production").sort((a, b) => b.createdAt - a.createdAt).slice(0, 100);
  const source = cards.find(c => c.id === sourceId);
  const isFollowUp = recommendation.due && focus.trim() === recommendation.due.task.goal && !source;

  async function start() {
    if (!focus.trim()) return;
    try {
      const evidence = selectTutorEvidence({ ...memory, focus, source, parent: isFollowUp ? recommendation.due : undefined });
      const result = await controller.call({ action: "plan", provider: selection.provider, ollamaModel: selection.selectedModel || undefined,
        context: { level, minutes, explanationLanguage: memory.preferences.explanationLanguage, focus: focus.trim(), evidence, previousTask: isFollowUp ? recommendation.due?.task : undefined } });
      if (result?.action !== "plan") return;
      const session = createTutorSession({ task: result.task, level, minutes, explanationLanguage: memory.preferences.explanationLanguage, provider: selection.provider, model: selection.provider === "ollama" ? selection.selectedModel || undefined : undefined,
        reason: source ? "Você escolheu uma frase salva como ponto de partida. A situação foi criada pelo tutor." : isFollowUp ? recommendation.reason : "Você escolheu este foco para praticar.",
        evidence, parentSessionId: isFollowUp ? recommendation.due?.id : undefined, supportUsed: !!source || memoryViewed });
      await controller.commit(() => session);
      onOpen(session);
    } catch (e) { controller.setError(e instanceof Error ? e.message : "Não foi possível iniciar."); }
  }

  return <Card className="space-y-5 p-5 sm:p-7">
    <div><p className="text-xs font-semibold uppercase tracking-wider text-accent">{isFollowUp ? "Hora de retomar" : "Um foco para agora"}</p><p className="mt-2 text-sm text-ink-soft">{recommendation.reason}</p></div>
    <label className="block space-y-2 text-sm font-medium text-ink"><span>O que você quer conseguir fazer?</span><input value={focus} maxLength={500} disabled={controller.busy} onChange={e => setFocus(e.target.value)} className={tutorInputClass} /></label>
    <details className="space-y-4"><summary className="cursor-pointer text-sm text-ink-soft">Ajustar sessão · {minutes} min · {level}</summary>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block space-y-2 text-sm text-ink-soft"><span>Tempo aproximado</span><select className={tutorInputClass} value={minutes} disabled={controller.busy} onChange={e => setMinutes(Number(e.target.value) as 5 | 10 | 20)}>{[5, 10, 20].map(m => <option key={m} value={m}>{m} minutos</option>)}</select></label>
      <label className="block space-y-2 text-sm text-ink-soft"><span>Nível para esta tarefa</span><select className={tutorInputClass} value={level} disabled={controller.busy} onChange={e => setLevel(e.target.value as EnglishLevel)}>{ENGLISH_LEVELS.map(l => <option key={l.value} value={l.value}>{l.value}</option>)}</select></label>
    </div>
    <label className="block space-y-2 text-sm text-ink-soft"><span>Usar meu conteúdo como ponto de partida</span><select className={tutorInputClass} value={sourceId} disabled={controller.busy} onChange={e => setSourceId(e.target.value)}><option value="">Deixar o tutor propor uma situação</option>{cards.map(c => <option key={c.id} value={c.id}>{c.front.slice(0, 100)}</option>)}</select></label>
    <ProviderPicker selection={selection} disabled={controller.busy} />
    </details>
    {!selection.providerReady && <Notice>Conecte uma IA para conversar com seu tutor. Suas revisões e os conteúdos continuam disponíveis.<div className="mt-3 flex flex-wrap gap-2"><Button onClick={onSettings}>Conectar IA</Button><Button variant="secondary" onClick={onPractice}>Praticar agora</Button><Button variant="ghost" onClick={onContent}>Adicionar conteúdo</Button></div></Notice>}
    <p className="text-xs text-ink-muted">{selection.activeProvider?.label ?? "A IA escolhida"} receberá seu objetivo e até seis registros permitidos. O nível informado orienta a tarefa; não é um diagnóstico.</p>
    {controller.error && <Notice tone="error" role="alert">{controller.error}</Notice>}
    <div className="flex flex-wrap gap-3"><Button disabled={controller.busy || controller.fatal || !selection.providerReady || !focus.trim()} onClick={() => void start()}>{controller.busy ? "Preparando sua situação…" : "Começar a sessão"}</Button>{controller.busy && <Button variant="ghost" onClick={controller.cancel}>Cancelar</Button>}
      {!controller.busy && focus.trim() !== memory.preferences.goal && <Button variant="ghost" onClick={() => void saveTutorPreferences({ ...memory.preferences, goal: focus.trim() }).catch(e => controller.setError(String(e)))}>Guardar como meu objetivo</Button>}
    </div>
  </Card>;
}
