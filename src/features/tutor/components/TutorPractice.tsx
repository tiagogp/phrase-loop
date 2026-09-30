"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProviderPicker } from "@/features/cards/components/ProviderPicker";
import { useProviderSelection } from "@/features/cards/hooks/useProviderSelection";
import { synthesizeSpeech } from "@/features/converse/api";
import { useCorrectionAudio } from "@/features/correct/hooks/useCorrectionAudio";
import { saveGeneratedDeck } from "@/lib/store/repository";
import { allowedTutorEvidence, feedbackLabels, nextTutorReview, tutorSummary } from "../model";
import { buildTutorPhrase } from "../phrase";
import { saveTutorPreferences, type TutorMemory } from "../store";
import { MAX_TUTOR_ATTEMPTS, type TutorContext, type TutorSession } from "../types";
import { useTutorSession } from "../useTutorSession";
import { TutorMemoryPanel, tutorInputClass } from "./TutorMemoryPanel";
import type { TutorWorkspaceProps } from "./TutorWorkspace";

export function TutorPractice({ initial, memory, onNew, ...props }: TutorWorkspaceProps & { initial: TutorSession; memory: TutorMemory; onNew: () => void }) {
  const { session: value, commit, call, busy, saving, fatal, error, setError, cancel, current } = useTutorSession(initial);
  const session = value!;
  const selection = useProviderSelection({ initialProvider: initial.provider, initialModel: initial.model });
  const [question, setQuestion] = useState("");
  const [showMemory, setShowMemory] = useState(false);
  const [audioNote, setAudioNote] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [savingPhrase, setSavingPhrase] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrl = useRef<string | null>(null);
  const ttsRequest = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; ttsRequest.current?.abort(); audioRef.current?.pause(); if (audioUrl.current) URL.revokeObjectURL(audioUrl.current); }; }, []);
  function updateDraft(text: string) { if (mounted.current) void commit(s => ({ ...s!, draft: text.slice(0, 3000) })).catch(() => undefined); }
  const audio = useCorrectionAudio({ onNote: setAudioNote, onText: updater => updateDraft(updater(current.current?.draft ?? "")), maxDurationMs: 90_000 });
  const blocked = busy || fatal || audio.recording || audio.transcribing || savingPhrase;
  const last = session.attempts.at(-1);
  const parent = memory.sessions.find(s => s.id === session.parentSessionId);
  const context: TutorContext = {
    level: session.level, minutes: session.minutes, explanationLanguage: session.explanationLanguage, focus: session.task.goal,
    // Reapply exclusions on every call, including sessions opened before the preference changed.
    evidence: allowedTutorEvidence(session.evidence, memory.preferences, memory.sessions),
  };
  const provider = { provider: selection.provider, ollamaModel: selection.selectedModel || undefined };

  async function evaluate() {
    if (blocked || !session.draft.trim() || session.attempts.length >= MAX_TUTOR_ATTEMPTS) return;
    const result = await call({ action: "evaluate", ...provider, context, task: session.task, text: session.draft.trim() });
    if (result?.action !== "evaluate") return;
    await commit(s => ({ ...s!, provider: selection.provider, model: selection.provider === "ollama" ? selection.selectedModel || undefined : undefined, phase: "feedback", draft: "", attempts: [...s!.attempts, {
      id: crypto.randomUUID(), text: session.draft.trim(), supportUsed: session.supportUsed || session.attempts.length > 0,
      createdAt: Date.now(), feedback: result.feedback, judge: result.judge,
    }] })).catch(() => undefined);
  }

  async function ask(text: string) {
    if (blocked || !text.trim() || session.help.length >= 20) return;
    const result = await call({ action: "help", ...provider, context, task: session.task, text: session.draft || last?.text || "", question: text.trim(), feedback: last?.feedback, history: session.help.slice(-4).map(({ question, answer }) => ({ question, answer })) });
    if (result?.action !== "help") return;
    await commit(s => ({ ...s!, provider: selection.provider, model: selection.provider === "ollama" ? selection.selectedModel || undefined : undefined, supportUsed: true, help: [...s!.help, { question: text.trim(), answer: result.answer, createdAt: Date.now() }] })).catch(() => undefined);
    setQuestion("");
  }

  async function finish() {
    await commit(s => ({ ...s!, phase: "complete", completedAt: Date.now(), nextReviewAt: nextTutorReview(s!, Date.now()) })).catch(() => undefined);
  }

  async function listen() {
    if (!last || audioLoading) return;
    setAudioLoading(true); setAudioNote(null);
    const controller = new AbortController(); ttsRequest.current = controller;
    try {
      const blob = await synthesizeSpeech(last.feedback.example.english, controller.signal);
      if (!mounted.current) return;
      audioRef.current?.pause();
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
      audioUrl.current = URL.createObjectURL(blob);
      const player = new Audio(audioUrl.current); audioRef.current = player;
      await player.play();
    } catch (e) { if (mounted.current && !controller.signal.aborted) setAudioNote(e instanceof Error ? e.message : "Não foi possível gerar o áudio."); }
    finally { if (mounted.current) setAudioLoading(false); }
  }

  async function savePhrase() {
    setSavingPhrase(true); setError(null);
    try {
      const { cards, candidate } = await buildTutorPhrase(session);
      await saveGeneratedDeck(cards, [candidate]);
      await commit(s => ({ ...s!, savedPhraseId: candidate.id }));
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar a frase."); }
    finally { setSavingPhrase(false); }
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Button variant="ghost" onClick={props.onBack} disabled={saving || audio.recording || audio.transcribing}>{session.phase === "complete" ? "← Voltar" : "← Pausar e voltar"}</Button>
      <span role="status" className="text-xs text-ink-muted">{fatal ? "Não foi possível salvar" : saving ? "Salvando…" : "Sessão salva neste navegador"}</span>
    </div>
    <PageHeader eyebrow={`Seu tutor · ${session.minutes} min · ${session.level}`} title={session.task.goal} description={session.reason} />
    <ol className="grid grid-cols-3 gap-2 text-xs text-ink-muted" aria-label="Etapas da sessão">
      {["Sua resposta", "Feedback e nova tentativa", "Retomar depois"].map((label, i) => <li key={label} aria-current={(session.phase === "practice" ? 0 : session.phase === "feedback" ? 1 : 2) === i ? "step" : undefined} className={`rounded border p-3 ${(session.phase === "practice" ? 0 : session.phase === "feedback" ? 1 : 2) === i ? "border-accent/40 bg-accent/5 text-accent" : "border-line"}`}>{i + 1}. {label}</li>)}
    </ol>
    {error && <Notice tone="error" role="alert">{error}{!fatal && " Você pode tentar novamente; seu texto continua salvo."}</Notice>}
    {busy && <div role="status" className="flex items-center gap-3 text-sm text-ink-soft">O tutor está pensando…<Button variant="ghost" onClick={cancel}>Cancelar pedido</Button></div>}
    {session.phase !== "complete" && <ProviderPicker selection={selection} disabled={blocked} />}
    {!selection.providerReady && session.phase !== "complete" && <Notice>A IA está indisponível. Você pode guardar sua resposta, conectar uma IA ou voltar às revisões.<div className="mt-3 flex flex-wrap gap-2"><Button onClick={props.onSettings} disabled={saving}>Configurar IA</Button><Button variant="secondary" onClick={props.onPractice} disabled={saving}>Ir para revisões</Button></div></Notice>}

    {session.phase === "practice" && <Card className="space-y-5 p-5 sm:p-7">
      <div><p className="text-xs font-semibold uppercase tracking-wider text-accent">{session.attempts.length ? "Reconstrua sua resposta" : session.parentSessionId ? "Primeiro, tente recuperar" : "Sua situação"}</p><p className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-ink">{session.task.situation}</p></div>
      <p className="text-sm leading-relaxed text-ink-soft">{session.task.instruction}</p>
      {last && <Notice>{last.feedback.retryInstruction}</Notice>}
      <label className="block space-y-2 text-sm font-medium text-ink"><span>Sua resposta em inglês</span><textarea autoFocus value={session.draft} onChange={e => updateDraft(e.target.value)} maxLength={3000} rows={5} className={tutorInputClass} readOnly={blocked} placeholder="Escreva do seu jeito, mesmo que ainda faltem palavras." lang="en" /></label>
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={blocked || !selection.providerReady || !session.draft.trim()} onClick={() => void evaluate()}>Receber feedback</Button>
        <Button variant="secondary" disabled={blocked || !selection.providerReady || session.help.length >= 20} onClick={() => void ask("Me dê uma pequena dica para começar, sem mostrar a resposta completa.")}>Preciso de uma dica</Button>
        <Button variant="ghost" disabled={busy || fatal || audio.transcribing} onClick={() => audio.recording ? audio.stopRecording() : void audio.startRecording()}>{audio.recording ? "Parar gravação" : audio.transcribing ? "Transcrevendo…" : "Falar minha resposta"}</Button>
      </div>
      <p className="text-xs text-ink-muted">{session.supportUsed ? "Esta tentativa será registrada com apoio." : "Tente antes de pedir uma dica. O apoio usado fica registrado."} Ao falar, revise a transcrição antes de enviar. A avaliação considera o texto.</p>
      {audioNote && <p role="status" className="text-sm text-ink-soft">{audioNote}</p>}
    </Card>}

    {session.phase === "feedback" && last && <Card className="space-y-5 p-5 sm:p-7" aria-label="Feedback do tutor">
      <p role="status" className="text-xs font-semibold uppercase tracking-wider text-accent">{feedbackLabels[last.feedback.status]}</p>
      <div><p className="mb-2 text-xs text-ink-muted">Sua resposta · {last.supportUsed ? "com apoio" : "sem pedir apoio"}</p><blockquote className="border-l-2 border-accent/40 pl-4 text-ink" lang="en">{last.text}</blockquote></div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{last.feedback.feedback}</p>
      {last.feedback.points.map((point, i) => <div key={i} className="space-y-2 rounded-md border border-line p-4"><p className="text-sm text-ink" lang="en">{point.original} → <strong>{point.revised}</strong></p><p className="text-sm leading-relaxed text-ink-soft">{point.explanation}</p></div>)}
      <div className="rounded-md bg-accent/5 p-4"><p className="text-xs font-medium text-accent">Uma resposta possível · exemplo gerado pela IA</p><p className="mt-2 text-ink" lang="en">{last.feedback.example.english}</p><p className="mt-2 text-sm text-ink-soft">{last.feedback.example.meaning}</p><Button className="mt-2" variant="ghost" size="sm" disabled={audioLoading} onClick={() => void listen()}>{audioLoading ? "Gerando áudio…" : "Ouvir com Kokoro"}</Button>{audioNote && <p role="status" className="text-xs text-ink-muted">{audioNote}</p>}</div>
      <div className="flex flex-wrap gap-3">
        {session.attempts.length < MAX_TUTOR_ATTEMPTS && <Button disabled={blocked} onClick={() => void commit(s => ({ ...s!, phase: "practice", supportUsed: true, draft: "" })).catch(() => undefined)}>Tentar novamente com minhas palavras</Button>}
        <Button variant="secondary" disabled={blocked} onClick={() => void finish()}>Encerrar e ver meu resumo</Button>
      </div>
      {session.attempts.length >= MAX_TUTOR_ATTEMPTS && <p className="text-sm text-ink-soft">Você já trabalhou esta situação três vezes. Vamos encerrar este foco e retomá-lo depois.</p>}
      <p className="text-xs text-ink-muted">Avaliação de {last.judge.provider}{last.judge.model ? ` · ${last.judge.model}` : ""}. Formulações diferentes do exemplo podem ser válidas.</p>
      <Button variant="ghost" size="sm" disabled={blocked || last.disputed} onClick={() => void commit(s => ({ ...s!, attempts: s!.attempts.map(a => a.id === last.id ? { ...a, disputed: true } : a) })).catch(() => undefined)}>{last.disputed ? "Avaliação contestada: fora da memória do tutor" : "Não concordo: desconsiderar esta avaliação"}</Button>
    </Card>}

    {session.phase === "complete" && <Card className="space-y-5 p-5 sm:p-7">
      <h2 className="text-xl font-semibold text-ink">O que aconteceu nesta sessão</h2>
      <p className="text-sm leading-relaxed text-ink-soft">{tutorSummary(session)}</p>
      {session.draft.trim() && <div className="rounded border border-line p-4"><p className="text-xs text-ink-muted">Rascunho não enviado · sem avaliação</p><p className="mt-2 whitespace-pre-wrap text-sm text-ink" lang="en">{session.draft}</p></div>}
      {parent && session.attempts.length > 0 && <Notice>Você voltou ao objetivo após {Math.max(0, Math.floor((session.attempts[0].createdAt - (parent.completedAt ?? parent.updatedAt)) / 86_400_000))} dias completos. Compare as respostas e as situações abaixo; tarefas diferentes não são um mesmo teste.</Notice>}
      {parent?.attempts.at(-1) && <div className="rounded border border-line p-4"><p className="text-xs text-ink-muted">Sessão anterior · {parent.task.situation}</p><p className="mt-2 text-sm text-ink" lang="en">{parent.attempts.at(-1)!.text}</p><p className="mt-2 text-xs text-ink-muted">{parent.attempts.at(-1)!.supportUsed ? "Com apoio" : "Sem apoio registrado"} · {new Date(parent.updatedAt).toLocaleDateString("pt-BR")}</p></div>}
      {session.attempts.map((attempt, i) => <div key={attempt.id} className="rounded border border-line p-4"><p className="text-xs text-ink-muted">Tentativa {i + 1} · {attempt.supportUsed ? "com apoio ou feedback" : "sem pedir apoio"}</p><p className="mt-2 whitespace-pre-wrap text-sm text-ink" lang="en">{attempt.text}</p><p className="mt-2 text-xs text-ink-muted">{attempt.disputed ? "Avaliação contestada" : feedbackLabels[attempt.feedback.status]} · IA: {attempt.judge.provider}{attempt.judge.model ? ` / ${attempt.judge.model}` : ""}</p></div>)}
      {session.nextReviewAt && !session.revisitedAt && <Notice>Retomada a partir de <strong>{new Date(session.nextReviewAt).toLocaleDateString("pt-BR")}</strong>. Ela aparecerá em Hoje para você tentar outra situação antes de ver o exemplo.</Notice>}
      {session.revisitedAt && <p className="text-sm text-ink-muted">Este objetivo foi retomado em {new Date(session.revisitedAt).toLocaleDateString("pt-BR")}.</p>}
      {last && !last.disputed && last.feedback.status !== "uncertain" && <section className="space-y-3 border-t border-line pt-4"><h3 className="font-medium text-ink">Uma frase útil para levar</h3><p lang="en" className="text-sm text-ink">{last.feedback.example.english}</p><p className="text-xs text-ink-muted">Exemplo gerado pelo tutor. Será salvo com o significado em português e as duas direções de revisão.</p><div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={blocked || !!session.savedPhraseId} onClick={() => void savePhrase()}>{session.savedPhraseId ? "Frase salva para revisão e Anki" : savingPhrase ? "Salvando frase…" : "Salvar frase para revisão e Anki"}</Button><Button variant="ghost" disabled={audioLoading} onClick={() => void listen()}>{audioLoading ? "Gerando áudio…" : "Ouvir com Kokoro"}</Button></div>{session.savedPhraseId && <p className="text-xs text-ink-muted">Em Kokoro & Anki, use “Usar minhas frases salvas” para incluir esta frase na exportação.</p>}{audioNote && <p role="status" className="text-xs text-ink-muted">{audioNote}</p>}</section>}
      <div className="flex flex-wrap gap-2"><Button onClick={onNew} disabled={saving}>Voltar ao meu tutor</Button><Button variant="secondary" onClick={props.onPractice} disabled={saving}>Revisar minhas frases</Button><Button variant="ghost" onClick={props.onTools} disabled={saving}>Kokoro & Anki</Button><Button variant="ghost" onClick={props.onConversation}>Conversar livremente</Button></div>
      {session.nextReviewAt && !session.revisitedAt && !memory.preferences.ignoredEvidenceIds.includes(`session:${session.id}`) && <Button variant="ghost" size="sm" onClick={() => void saveTutorPreferences({ ...memory.preferences, ignoredEvidenceIds: [...memory.preferences.ignoredEvidenceIds, `session:${session.id}`] }).catch(e => setError(String(e)))}>Não sugerir mais esta retomada</Button>}
    </Card>}

    {session.phase !== "complete" && <section className="space-y-3 rounded-lg border border-line p-5" aria-label="Perguntar ao tutor">
      <h2 className="text-sm font-semibold text-ink">Pode perguntar ao tutor</h2>
      <p className="text-xs text-ink-muted">Peça uma explicação, um exemplo ou questione a correção. Isso conta como apoio na próxima resposta.</p>
      {session.help.slice(-3).map((help, i) => <div key={`${help.createdAt}-${i}`} className="space-y-2 border-l-2 border-line pl-3 text-sm"><p className="font-medium text-ink">Você: {help.question}</p><p className="whitespace-pre-wrap leading-relaxed text-ink-soft">Tutor: {help.answer}</p></div>)}
      <label className="block space-y-2 text-sm text-ink-soft"><span>Sua pergunta</span><textarea rows={2} maxLength={600} className={tutorInputClass} value={question} onChange={e => setQuestion(e.target.value)} disabled={blocked} placeholder="Por que usamos esta construção?" /></label>
      <Button variant="secondary" disabled={blocked || !selection.providerReady || !question.trim() || session.help.length >= 20} onClick={() => void ask(question)}>Perguntar</Button>
      {session.help.length >= 20 && <p className="text-xs text-ink-muted">Vamos fazer uma pausa nas explicações. Você pode encerrar esta sessão e começar outro foco.</p>}
    </section>}
    <div className="flex flex-wrap gap-2">
      <Button variant="ghost" disabled={blocked} aria-expanded={showMemory} aria-controls="active-tutor-memory" onClick={() => {
        if (!showMemory && session.phase === "practice") void commit(s => ({ ...s!, supportUsed: true })).catch(() => undefined);
        setShowMemory(!showMemory);
      }}>O que meu tutor lembra</Button>
      {session.phase === "practice" && <Button variant="ghost" disabled={blocked} onClick={() => void finish()}>Encerrar este foco</Button>}
    </div>
    {showMemory && <div id="active-tutor-memory"><TutorMemoryPanel memory={memory} /></div>}
  </div>;
}
