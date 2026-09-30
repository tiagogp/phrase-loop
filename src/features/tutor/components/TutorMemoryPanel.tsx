"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { saveTutorPreferences, type TutorMemory } from "../store";
import type { TutorPreferences } from "../types";

export const tutorInputClass = "w-full rounded-md border border-line bg-input px-3 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-60";

export function TutorMemoryPanel({ memory }: { memory: TutorMemory }) {
  const [goal, setGoal] = useState(memory.preferences.goal);
  const [language, setLanguage] = useState(memory.preferences.explanationLanguage);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function save(value: TutorPreferences) {
    setSaving(true); setMessage(null);
    try { await saveTutorPreferences(value); setMessage("Memória atualizada."); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  }
  return <section aria-label="O que meu tutor lembra" className="space-y-4 rounded-lg border border-line bg-card p-5">
    <h2 className="font-semibold text-ink">O que meu tutor lembra</h2>
    <p className="text-sm text-ink-soft">Seu histórico fica neste navegador. Ao pedir uma tarefa, o tutor recebe seu objetivo e até seis registros relevantes. Você pode excluir registros desse contexto sem apagar seu histórico.</p>
    <label className="block space-y-2 text-sm text-ink-soft"><span>O que quero conseguir fazer em inglês</span>
      <input className={tutorInputClass} maxLength={500} value={goal} onChange={e => setGoal(e.target.value)} placeholder="Ex.: participar das reuniões da minha equipe" /></label>
    <label className="block space-y-2 text-sm text-ink-soft"><span>Idioma das explicações nas próximas sessões</span>
      <select className={tutorInputClass} value={language} onChange={e => setLanguage(e.target.value as "pt" | "en")}><option value="pt">Português</option><option value="en">English</option></select></label>
    <Button variant="secondary" disabled={saving} onClick={() => void save({ ...memory.preferences, goal: goal.trim(), explanationLanguage: language })}>Salvar preferências</Button>
    {message && <p role="status" className="text-sm text-ink-soft">{message}</p>}
    <h3 className="border-t border-line pt-4 text-sm font-medium text-ink">Observações recentes, com a origem</h3>
    {!memory.observations.length && <p className="text-sm text-ink-muted">Ainda não há respostas registradas. O tutor começa pelo objetivo e pelo nível que você informou.</p>}
    <ul className="max-h-96 space-y-3 overflow-y-auto">
      {memory.observations.slice(0, 12).map(observation => {
        const ignored = memory.preferences.ignoredEvidenceIds.includes(observation.id);
        return <li key={observation.id} className="rounded border border-line p-3 text-sm">
          <p className="font-medium text-ink">{observation.label} · {new Date(observation.createdAt).toLocaleDateString("pt-BR")}</p>
          <p className="mt-1 whitespace-pre-wrap text-ink-soft" lang="en">{observation.text}</p>
          <p className="mt-2 text-xs text-ink-muted">{observation.detail} · {observation.supported === null ? "Apoio não registrado" : observation.supported ? "Com apoio" : "Sem apoio registrado"}</p>
          <Button variant="ghost" size="sm" disabled={saving} onClick={() => void save({ ...memory.preferences, ignoredEvidenceIds: ignored ? memory.preferences.ignoredEvidenceIds.filter(id => id !== observation.id) : [...memory.preferences.ignoredEvidenceIds, observation.id] })}>{ignored ? "Voltar a usar no tutor" : "Não usar no tutor"}</Button>
        </li>;
      })}
    </ul>
    <Notice>Os resultados da IA são avaliações de tarefas específicas. Eles não comprovam domínio de um nível nem avaliam sua pronúncia.</Notice>
    {memory.preferences.ignoredEvidenceIds.length > 0 && <Button variant="ghost" disabled={saving} onClick={() => void save({ ...memory.preferences, ignoredEvidenceIds: [] })}>Voltar a permitir todos os registros ({memory.preferences.ignoredEvidenceIds.length})</Button>}
  </section>;
}
