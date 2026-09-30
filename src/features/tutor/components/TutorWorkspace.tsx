"use client";

import Disclosure from "@/components/ui/Disclosure";

import { useTutorTranslation } from "../useTutorTranslation";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingStatus } from "@/components/ui/LoadingStatus";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProviderPicker } from "@/features/cards/components/ProviderPicker";
import { useProviderSelection } from "@/features/cards/hooks/useProviderSelection";
import { getLearningProfile } from "@/features/settings/learningProfile";
import { ENGLISH_LEVELS } from "@/features/discover/constants";
import type { EnglishLevel } from "@/features/discover/types";
import { createTutorSession, selectTutorEvidence, tutorRecommendation } from "../model";
import { chooseTutorScenario, TUTOR_CONCEPTS, isTutorConceptId } from "../catalog";
import { getTutorSessions, loadTutorMemory, recordTutorExposure, type TutorMemory } from "../store";
import type { TutorSession } from "../types";
import { useTutorMemory } from "../useTutorMemory";
import { useTutorSession } from "../useTutorSession";
import { TutorMemoryPanel, tutorInputClass } from "./TutorMemoryPanel";
import { TutorPractice } from "./TutorPractice";

export interface TutorWorkspaceProps {
  intent?: "recommended" | "new";
  sourceCardId?: string;
  onBack: () => void;
  onSettings: () => void;
  onPractice: () => void;
  onConversation: () => void;
  onContent: () => void;
  onTools: () => void;
  onLocalPractice?: () => void;
}

export default function TutorWorkspace(props: TutorWorkspaceProps) {
  const { t, localize } = useTutorTranslation();
  const { memory, error, refresh } = useTutorMemory();
  if (error) return <Notice tone="error">{localize(error)}<Button variant="secondary" onClick={() => void refresh()}>{t("Try again")}</Button><Button variant="ghost" onClick={props.onBack}>{t("Back")}</Button></Notice>;
  if (!memory) return <p role="status" className="text-sm text-ink-muted">{t("Loading your practice…")}</p>;
  return <TutorBody memory={memory} {...props} />;
}

function TutorBody({ memory, ...props }: TutorWorkspaceProps & { memory: TutorMemory }) {
  const { t, lang, localize } = useTutorTranslation();
  const [selected, setSelected] = useState<TutorSession | null>(() => props.intent !== "new" && !props.sourceCardId
    ? tutorRecommendation(memory.sessions, memory.preferences, getLearningProfile(), Date.now(), lang).active ?? null : null);
  const [launchSource, setLaunchSource] = useState(props.sourceCardId);
  const [launchMode, setLaunchMode] = useState(props.intent ?? "recommended");
  const [autoStart, setAutoStart] = useState(props.intent !== "new" || !!props.sourceCardId);
  const [showMemory, setShowMemory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  async function openHistory(session: TutorSession) {
    setOpening(true); setError(null);
    try {
      await recordTutorExposure([session.id], "history");
      const saved = (await getTutorSessions()).find(s => s.id === session.id);
      if (saved) setSelected(saved);
    } catch (e) { setError(String(e)); }
    finally { setOpening(false); }
  }
  async function openMemory() {
    if (showMemory) { setShowMemory(false); return; }
    setOpening(true);
    try { await recordTutorExposure(memory.sessions.map(s => s.id), "history"); setShowMemory(true); }
    catch (e) { setError(String(e)); }
    finally { setOpening(false); }
  }
  return <div className="space-y-6">
    {selected ? <TutorPractice key={selected.id} initial={selected} memory={memory} {...props} onNew={() => { setSelected(null); setShowMemory(false); setLaunchSource(undefined); setLaunchMode("new"); setAutoStart(false); }} /> : <>
      <Button variant="ghost" onClick={props.onBack}>{t("← Back")}</Button>
      <PageHeader eyebrow={t("English for a real situation")} title={launchMode === "new" ? t("Practice something new") : t("Your next practice")} description={t("Try in your own words. Understand the adjustment. Come back later to see what stayed.")} />
      <TutorSetup memory={memory} {...props} intent={launchMode} sourceCardId={launchSource} autoStart={autoStart} onOpen={setSelected} />
      {error && <Notice tone="error">{localize(error)}</Notice>}
      {memory.observations.length > 0 && <Button variant="ghost" disabled={opening} aria-expanded={showMemory} aria-controls="tutor-memory" onClick={() => void openMemory()}>{t("What my tutor remembers")}</Button>}
      {showMemory && <div id="tutor-memory"><TutorMemoryPanel memory={memory} /></div>}
      {memory.sessions.length > 0 && <section className="space-y-3" aria-label={t("Tutor sessions")}>
        <h2 className="font-semibold text-ink">{t("Your sessions")}</h2>
        {memory.sessions.slice(0, 8).map(session => <button key={session.id} disabled={opening} className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-card p-4 text-left hover:border-accent/40" onClick={() => void openHistory(session)}>
          <span className="text-sm font-medium text-ink">{localize(session.task.goal)}</span><span className="text-xs text-ink-muted">{new Date(session.createdAt).toLocaleDateString(lang === "pt" ? "pt-BR" : "en-US")} · {session.phase === "complete" ? t("View answers and summary") : t("Continue")} →</span>
        </button>)}
      </section>}
    </>}
  </div>;
}

function TutorSetup({ memory, autoStart, onOpen, onSettings, onPractice, onContent, intent, sourceCardId }: TutorWorkspaceProps & { memory: TutorMemory; autoStart: boolean; onOpen: (session: TutorSession) => void }) {
  const { t, lang, localize } = useTutorTranslation();
  const profile = getLearningProfile();
  const recommendation = tutorRecommendation(memory.sessions, memory.preferences, profile, memory.loadedAt, lang);
  const defaultFocus = useMemo(() => localize(intent === "new" ? tutorRecommendation([], memory.preferences, profile, memory.loadedAt, lang).focus : recommendation.focus), [intent, memory.preferences, memory.loadedAt, profile, lang, localize, recommendation.focus]);
  const [focus, setFocus] = useState(defaultFocus);
  const [level, setLevel] = useState<EnglishLevel>(profile.onboardingCompleted ? profile.level : "A2");
  const [minutes, setMinutes] = useState<5 | 10 | 20>(profile.dailyMinutes === 5 || profile.dailyMinutes === 20 ? profile.dailyMinutes : 10);
  const [sourceId, setSourceId] = useState(sourceCardId ?? "");
  const [starting, setStarting] = useState(false);
  const selection = useProviderSelection({ fallbackToEvaluator: true });
  const { call, commit, setError, error, fatal, busy, cancel } = useTutorSession(null);
  const started = useRef(false);
  const launching = useRef(false);
  const cards = memory.cards.filter(c => c.direction !== "production").sort((a, b) => b.createdAt - a.createdAt).slice(0, 100);

  const start = useCallback(async () => {
    if (!focus.trim() || launching.current) return;
    launching.current = true; setStarting(true); setError(null);
    try {
      // History/progress may have been opened since this workspace loaded.
      const fresh = await loadTutorMemory();
      const rec = tutorRecommendation(fresh.sessions, fresh.preferences, getLearningProfile(), Date.now(), lang);
      const existingSource = sourceId && fresh.sessions.find(s => s.sourceCardId === sourceId && s.phase !== "complete");
      if (existingSource) { onOpen(existingSource); return; }
      const source = fresh.cards.find(c => c.id === sourceId);
      if (sourceId && !source) throw new Error(t("This content is no longer available. Choose another source."));
      const parent = intent !== "new" && !source && focus.trim() === defaultFocus ? rec.due : undefined;
      const evidence = selectTutorEvidence({ ...fresh, focus, source, parent });
      const conceptId = parent?.skill?.conceptId;
      let task = !source && (conceptId || (!parent && focus.trim() === t("Talk about your professional experience")))
        ? chooseTutorScenario(conceptId ?? "present-perfect-duration", fresh.sessions) : undefined;
      if (!task) {
        const result = await call({ action: "plan", provider: selection.provider, ollamaModel: selection.selectedModel || undefined,
          context: { level, minutes, explanationLanguage: fresh.preferences.explanationLanguage, focus: focus.trim(), evidence, previousTask: parent?.task, targetSkill: parent?.skill?.label, targetConceptId: conceptId } });
        if (result?.action !== "plan") return;
        task = result.task;
      }
      const session = createTutorSession({ task, level, minutes, explanationLanguage: fresh.preferences.explanationLanguage, provider: selection.provider,
        model: selection.provider === "ollama" ? selection.selectedModel || undefined : undefined,
        reason: source ? t("Your source is the starting point. Now try to produce your own answer.") : parent ? rec.reason : t("A new situation to see what you can do."),
        evidence, parentSessionId: parent?.id, supportUsed: !!source });
      const taskConcept = task.scenarioId?.startsWith("duration-") ? "present-perfect-duration" : task.scenarioId?.startsWith("request-") ? "polite-requests" : undefined;
      session.skill = parent?.skill ?? (isTutorConceptId(taskConcept) ? { id: taskConcept, conceptId: taskConcept, label: TUTOR_CONCEPTS[taskConcept].label, originContext: task.situation, originSessionId: session.id } : undefined);
      session.sourceCardId = source?.id;
      session.exposures = source ? [{ id: crypto.randomUUID(), kind: "source", at: Date.now() }] : [];
      await commit(() => session);
      onOpen(session);
    } catch (e) { setError(e instanceof Error ? e.message : t("Could not start.")); }
    finally { launching.current = false; setStarting(false); }
  }, [focus, defaultFocus, sourceId, intent, level, minutes, selection.provider, selection.selectedModel, call, commit, setError, onOpen, lang, t]);

  useEffect(() => {
    let cancelled = false;
    if (autoStart && selection.providerReady && !started.current) queueMicrotask(() => {
      if (cancelled || started.current) return;
      started.current = true;
      void start();
    });
    return () => { cancelled = true; };
  }, [autoStart, selection.providerReady, start]);

  const blocked = busy || starting;
  return <Card className="space-y-5 p-5 sm:p-7">
    <p className="text-sm text-ink-soft">{intent === "new" ? t("You can choose another goal without losing your previous session.") : localize(recommendation.reason)}</p>
    {(!autoStart || error) && <label className="block space-y-2 text-sm font-medium text-ink"><span>{t("What do you want to be able to do?")}</span><input value={focus} maxLength={500} disabled={blocked} onChange={e => setFocus(e.target.value)} className={tutorInputClass} /></label>}
    <Disclosure title={`${t("Adjust session ·")} ${minutes} min · ${level}`} contentClassName="space-y-4" nested>
      <label className="block space-y-2 text-sm text-ink-soft"><span>{t("Level")}</span><select className={tutorInputClass} value={level} disabled={blocked} onChange={e => setLevel(e.target.value as EnglishLevel)}>{ENGLISH_LEVELS.map(l => <option key={l.value} value={l.value}>{l.value}</option>)}</select></label>
      <label className="block space-y-2 text-sm text-ink-soft"><span>{t("Approximate time")}</span><select className={tutorInputClass} value={minutes} disabled={blocked} onChange={e => setMinutes(Number(e.target.value) as 5 | 10 | 20)}>{[5, 10, 20].map(m => <option key={m} value={m}>{t("{count} min", { count: m })}</option>)}</select></label>
      <label className="block space-y-2 text-sm text-ink-soft"><span>{t("Content as a starting point")}</span><select className={tutorInputClass} value={sourceId} disabled={blocked} onChange={e => setSourceId(e.target.value)}><option value="">{t("A situation suggested by PhraseLoop")}</option>{cards.map(c => <option key={c.id} value={c.id}>{c.front.slice(0, 100)}</option>)}</select></label>
      <ProviderPicker selection={selection} disabled={blocked} />
    </Disclosure>
    {!selection.providerReady && <Notice>{t("Connect an AI to receive feedback. You can also access your saved phrases.")}<div className="mt-3 flex flex-wrap gap-2"><Button onClick={onSettings}>{t("Connect AI")}</Button><Button variant="secondary" onClick={onPractice}>{t("Review phrases")}</Button><Button variant="ghost" onClick={onContent}>{t("Add content")}</Button></div></Notice>}
    {error && <Notice tone="error" role="alert">{localize(error)}</Notice>}
    <div className="flex flex-wrap gap-3"><Button loading={blocked} disabled={blocked || fatal || !selection.providerReady || !focus.trim()} onClick={() => void start()}>{blocked ? t("Preparing your situation…") : error ? t("Try again") : t("Start the session")}</Button></div>
    {blocked && <LoadingStatus action={busy ? <Button variant="ghost" size="sm" onClick={cancel}>{t("Cancel")}</Button> : undefined}>{t("Preparing your situation…")}</LoadingStatus>}
  </Card>;
}
