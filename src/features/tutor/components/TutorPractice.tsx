"use client";

import Disclosure from "@/components/ui/Disclosure";

import { useTutorTranslation } from "../useTutorTranslation";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingStatus } from "@/components/ui/LoadingStatus";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProviderPicker } from "@/features/cards/components/ProviderPicker";
import { useProviderSelection } from "@/features/cards/hooks/useProviderSelection";
import { synthesizeSpeech } from "@/features/converse/api";
import { useCorrectionAudio } from "@/features/correct/hooks/useCorrectionAudio";
import { saveGeneratedDeck } from "@/lib/store/repository";
import { allowedTutorEvidence, feedbackLabels, nextTutorReview, skillFromFirstAttempt, tutorSkillEvidence, tutorSummary } from "../model";
import { buildTutorPhrase } from "../phrase";
import { recordTutorExposure, saveTutorPreferences, type TutorMemory } from "../store";
import { allowedTutorAttempt, tutorSkillStates } from "../learning";
import { MAX_TUTOR_ATTEMPTS, type TutorContext, type TutorSession } from "../types";
import { useTutorSession } from "../useTutorSession";
import { TutorMemoryPanel, tutorInputClass } from "./TutorMemoryPanel";
import type { TutorWorkspaceProps } from "./TutorWorkspace";

export function TutorPractice({ initial, memory, onNew, ...props }: TutorWorkspaceProps & { initial: TutorSession; memory: TutorMemory; onNew: () => void }) {
  const { t, lang, localize } = useTutorTranslation();
  const { session: value, commit, call, busy, pendingAction, saving, fatal, error, setError, cancel, current } = useTutorSession(initial);
  const session = value!;
  const phaseHeading = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => { phaseHeading.current?.focus(); }, [session.phase]);
  const selection = useProviderSelection({ initialProvider: initial.provider, initialModel: initial.model });
  const [exposureReady, setExposureReady] = useState(initial.phase === "practice");
  const exposureStarted = useRef(false);
  useEffect(() => {
    if (initial.phase === "practice" || exposureStarted.current) return;
    exposureStarted.current = true;
    void commit(s => ({ ...s!, exposures: [...(s!.exposures ?? []), { id: crypto.randomUUID(), kind: "history", at: Date.now() }] }))
      .then(() => setExposureReady(true)).catch(() => undefined);
  }, [initial.phase, commit]);
  const [helpSource, setHelpSource] = useState<"hint" | "question">("question");
  const [question, setQuestion] = useState("");
  const [showHelp, setShowHelp] = useState(false);
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
  const blocked = !exposureReady || busy || fatal || audio.recording || audio.transcribing || savingPhrase;
  const last = session.attempts.at(-1);
  const parent = memory.sessions.find(s => s.id === session.parentSessionId);
  const context: TutorContext = {
    level: session.level, minutes: session.minutes, explanationLanguage: session.explanationLanguage, focus: session.task.goal,
    // Reapply exclusions on every call, including sessions opened before the preference changed.
    evidence: allowedTutorEvidence(session.evidence, memory.preferences, memory.sessions),
    targetSkill: session.skill?.label, targetConceptId: session.skill?.conceptId,
  };
  const reviewAt = session.phase === "complete" ? nextTutorReview(session, session.completedAt ?? session.updatedAt, memory.sessions, memory.preferences) : session.nextReviewAt;
  const provider = { provider: selection.provider, ollamaModel: selection.selectedModel || undefined };

  async function evaluate() {
    if (blocked || !session.draft.trim() || session.attempts.length >= MAX_TUTOR_ATTEMPTS) return;
    const submittedAt = Date.now();
    const result = await call({ action: "evaluate", ...provider, context, task: session.task, text: session.draft.trim() });
    if (result?.action !== "evaluate") return;
    await commit(s => {
      const attempt = {
      id: crypto.randomUUID(), text: session.draft.trim(), supportUsed: session.supportUsed || session.attempts.length > 0,
      createdAt: submittedAt, feedback: result.feedback, judge: result.judge,
      };
      return { ...s!, provider: selection.provider, model: selection.provider === "ollama" ? selection.selectedModel || undefined : undefined,
        phase: "feedback", draft: "", exposures: [...(s!.exposures ?? []), { id: crypto.randomUUID(), kind: "feedback", at: Math.max(Date.now(), submittedAt + 1) }], skill: skillFromFirstAttempt(s!, attempt), attempts: [...s!.attempts, attempt] };
    }).catch(() => undefined);
  }

  async function ask(text: string, source: "hint" | "question" = "question") {
    if (blocked || !text.trim() || session.help.length >= 20) return;
    setHelpSource(source);
    setShowHelp(true);
    const result = await call({ action: "help", ...provider, context, task: session.task, text: session.draft || last?.text || "", question: text.trim(), feedback: last?.feedback, history: session.help.slice(-4).map(({ question, answer }) => ({ question, answer })) });
    if (result?.action !== "help") return;
    await commit(s => ({ ...s!, provider: selection.provider, model: selection.provider === "ollama" ? selection.selectedModel || undefined : undefined, supportUsed: true, exposures: [...(s!.exposures ?? []), { id: crypto.randomUUID(), kind: "hint", at: Date.now() }], help: [...s!.help, { question: text.trim(), answer: result.answer, createdAt: Date.now() }] })).catch(() => undefined);
    setQuestion("");
  }

  async function finish() {
    await commit(s => {
      const now = Date.now();
      const completed = { ...s!, phase: "complete" as const, completedAt: now };
      return { ...completed, nextReviewAt: nextTutorReview(completed, now, memory.sessions, memory.preferences) };
    }).catch(() => undefined);
  }

  async function revealMemory() {
    if (showMemory) { setShowMemory(false); return; }
    try {
      await recordTutorExposure(memory.sessions.filter(s => s.id !== session.id).map(s => s.id), "history");
      await commit(s => ({ ...s!, supportUsed: true, exposures: [...(s!.exposures ?? []), { id: crypto.randomUUID(), kind: "history", at: Date.now() }] }));
      setShowMemory(true);
    } catch (e) { setError(e instanceof Error ? e.message : t("Could not record the history view.")); }
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
    } catch (e) { if (mounted.current && !controller.signal.aborted) setAudioNote(e instanceof Error ? e.message : t("Could not generate audio.")); }
    finally { if (mounted.current) setAudioLoading(false); }
  }

  async function savePhrase() {
    setSavingPhrase(true); setError(null);
    try {
      const { cards, candidate } = await buildTutorPhrase(session);
      await saveGeneratedDeck(cards, [candidate]);
      await commit(s => ({ ...s!, savedPhraseId: candidate.id }));
    } catch (e) { setError(e instanceof Error ? e.message : t("Could not save the phrase.")); }
    finally { setSavingPhrase(false); }
  }

  if (!exposureReady) return <div className="space-y-3"><p role="status">{error ? localize(error) : t("Opening the session…")}</p><Button onClick={props.onBack}>{t("Back")}</Button></div>;
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Button variant="ghost" onClick={props.onBack} disabled={saving || audio.recording || audio.transcribing}>{session.phase === "complete" ? t("← Back") : t("← Pause and go back")}</Button>
      <span className="text-xs text-ink-muted">{fatal ? t("Could not save") : saving ? t("Saving…") : t("Session saved in this browser")}</span>
    </div>
    <PageHeader eyebrow={t("Your tutor · {minutes} min · {level}", { minutes: session.minutes, level: session.level })} title={localize(session.task.goal)} description={localize(session.reason)} />
    <ol className="grid grid-cols-3 gap-2 text-xs text-ink-muted" aria-label={t("Session steps")}>
      {[t("Your answer"), t("Feedback and another attempt"), t("Revisit later")].map((label, i) => <li key={label} aria-current={(session.phase === "practice" ? 0 : session.phase === "feedback" ? 1 : 2) === i ? "step" : undefined} className={`rounded border p-3 ${(session.phase === "practice" ? 0 : session.phase === "feedback" ? 1 : 2) === i ? "border-accent/40 bg-accent/5 text-accent" : "border-line"}`}>{i + 1}. {label}</li>)}
    </ol>
    {error && <Notice tone="error" role="alert">{localize(error)}{" "}{!fatal && t("You can try again; your text is still saved.")}
      {!fatal && props.onLocalPractice && <div className="mt-3"><Button variant="secondary" disabled={blocked} onClick={props.onLocalPractice}>{t("Continue with a local practice")}</Button><p className="mt-2 text-xs">{t("Your tutor session stays saved. You can return to it later.")}</p></div>}
    </Notice>}
    {!selection.providerReady && session.phase !== "complete" && <Notice>{t("AI is unavailable. You can save your answer, connect an AI, or return to reviews.")}<div className="mt-3 flex flex-wrap gap-2"><Button onClick={props.onSettings} disabled={saving}>{t("Set up AI")}</Button><Button variant="secondary" onClick={props.onPractice} disabled={saving}>{t("Go to reviews")}</Button></div></Notice>}

    {session.phase === "practice" && <Card className="space-y-5 p-5 sm:p-7">
      <div><h2 ref={phaseHeading} tabIndex={-1} className="text-xs font-semibold uppercase tracking-wider text-accent">{session.attempts.length ? t("Rebuild your answer") : session.parentSessionId ? t("First, try to recall") : t("Your situation")}</h2><p className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-ink">{localize(session.task.situation)}</p></div>
      <p className="text-sm leading-relaxed text-ink-soft">{localize(session.task.instruction)}</p>
      {last && <Notice>{last.feedback.retryInstruction}</Notice>}
      <label className="flex flex-col gap-2 text-sm font-medium text-ink"><span>{t("Your answer in English")}</span><textarea value={session.draft} onChange={e => updateDraft(e.target.value)} maxLength={3000} rows={5} className={tutorInputClass} readOnly={blocked} placeholder={t("Write in your own way, even if you are still missing some words.")} lang="en" /></label>
      <div className="flex flex-wrap items-center gap-2">
        <Button loading={pendingAction === "evaluate"} disabled={blocked || !selection.providerReady || !session.draft.trim()} onClick={() => void evaluate()}>{pendingAction === "evaluate" ? t("Analyzing your answer…") : t("Get feedback")}</Button>
        <Button variant="secondary" loading={pendingAction === "help" && helpSource === "hint"} disabled={blocked || !selection.providerReady || session.help.length >= 20} onClick={() => void ask(t("Give me a small hint to get started, without showing the full answer."), "hint")}>{pendingAction === "help" && helpSource === "hint" ? t("Preparing a hint…") : t("I need a hint")}</Button>
        <Button variant="ghost" disabled={busy || fatal || audio.transcribing} onClick={() => audio.recording ? audio.stopRecording() : void audio.startRecording()}>{audio.recording ? t("Stop recording") : audio.transcribing ? t("Transcribing…") : t("Speak my answer")}</Button>
      </div>
      {busy && (pendingAction === "evaluate" || helpSource === "hint") && <LoadingStatus action={<Button variant="ghost" size="sm" onClick={cancel}>{t("Cancel request")}</Button>}>{pendingAction === "evaluate" ? t("The tutor is analyzing your answer…") : t("The tutor is preparing a hint…")}</LoadingStatus>}
      <p className="text-xs text-ink-muted">{session.supportUsed ? t("This attempt will be recorded as supported.") : t("Try before asking for a hint. Any support used is recorded.")} {t("When speaking, check the transcript before sending. The assessment uses the text.")}</p>
      {audioNote && <p role="status" className="text-sm text-ink-soft">{audioNote}</p>}
    </Card>}

    {session.phase === "feedback" && last && <Card className="space-y-5 p-5 sm:p-7" aria-label={t("Tutor feedback")}>
      <h2 ref={phaseHeading} tabIndex={-1} className="text-xs font-semibold uppercase tracking-wider text-accent">{localize(feedbackLabels[last.feedback.status])}</h2>
      {session.skill && <p className="text-sm font-medium text-ink">{t("Skill practiced:")} {localize(session.skill.label)} · {last.feedback.skill?.result === "demonstrated" ? t("you used it successfully in this answer") : last.feedback.skill?.result === "needs_work" ? t("still needs practice") : t("inconclusive result")}</p>}
      <div><p className="mb-2 text-xs text-ink-muted">{t("Your answer ·")} {last.supportUsed ? t("with support") : t("without asking for support")}</p><blockquote className="border-l-2 border-accent/40 pl-4 text-ink" lang="en">{last.text}</blockquote></div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{last.feedback.feedback}</p>
      {last.feedback.points.map((point, i) => <div key={i} className="space-y-2 rounded-md border border-line p-4"><p className="text-sm text-ink" lang="en">{point.original} → <strong>{point.revised}</strong></p><p className="text-sm leading-relaxed text-ink-soft">{point.explanation}</p></div>)}
      <div className="rounded-md bg-accent/5 p-4"><p className="text-xs font-medium text-accent">{t("One possible answer · AI-generated example")}</p><p className="mt-2 text-ink" lang="en">{last.feedback.example.english}</p><p className="mt-2 text-sm text-ink-soft">{last.feedback.example.meaning}</p><Button className="mt-2" variant="ghost" size="sm" disabled={audioLoading} onClick={() => void listen()}>{audioLoading ? t("Generating audio…") : t("Listen to the example")}</Button>{audioNote && <p role="status" className="text-xs text-ink-muted">{audioNote}</p>}</div>
      <div className="flex flex-wrap gap-3">
        {session.attempts.length < MAX_TUTOR_ATTEMPTS && <Button disabled={blocked} onClick={() => void commit(s => ({ ...s!, phase: "practice", supportUsed: true, draft: "" })).catch(() => undefined)}>{t("Try again in my own words")}</Button>}
        <Button variant="secondary" disabled={blocked} onClick={() => void finish()}>{t("Finish and see my summary")}</Button>
      </div>
      {session.attempts.length >= MAX_TUTOR_ATTEMPTS && <p className="text-sm text-ink-soft">{t("You have practiced this situation three times. Let's finish this focus and revisit it later.")}</p>}
      <p className="text-xs text-ink-muted">{t("Assessment by")} {last.judge.provider}{last.judge.model ? ` · ${last.judge.model}` : ""}{t(". Wording different from the example can also be valid.")}</p>
      <Button variant="ghost" size="sm" disabled={blocked || last.disputed} onClick={() => void commit(s => ({ ...s!, attempts: s!.attempts.map(a => a.id === last.id ? { ...a, disputed: true } : a) })).catch(() => undefined)}>{last.disputed ? t("Assessment disputed: excluded from tutor memory") : t("I disagree: disregard this assessment")}</Button>
    </Card>}

    {session.phase === "complete" && <Card className="space-y-5 p-5 sm:p-7">
      <h2 ref={phaseHeading} tabIndex={-1} className="text-xl font-semibold text-ink">{t("What happened in this session")}</h2>
      <p className="text-sm leading-relaxed text-ink-soft">{tutorSummary(session, memory.preferences, lang)}</p>
      <Disclosure title={t("My attempts and evidence")} contentClassName="space-y-4" nested>
      {session.skill && <div className="rounded-lg border border-accent/25 bg-accent/5 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-accent">{t("Tracked skill")}</p><p className="mt-1 font-medium text-ink">{localize(session.skill.label)}</p><p className="mt-2 text-sm text-ink-soft">{(() => { const evidence = tutorSkillEvidence([...memory.sessions.filter(s => s.id !== session.id), session], session.skill!, memory.preferences); return t("{state}. Successful answers with support: {assisted}. Sessions improved after feedback: {improvements}. Verified uses in a new context: {transfers}. {next}", { state: localize(tutorSkillStates[evidence.state]), assisted: evidence.assisted, improvements: evidence.improvements, transfers: evidence.transfers, next: evidence.transfers ? t("Tracking new uses helps confirm the result.") : t("Evidence of transfer on another day and in another situation is still needed.") }); })()}</p></div>}
      {session.draft.trim() && <div className="rounded border border-line p-4"><p className="text-xs text-ink-muted">{t("Unsent draft · not assessed")}</p><p className="mt-2 whitespace-pre-wrap text-sm text-ink" lang="en">{session.draft}</p></div>}
      {parent && session.attempts.length > 0 && <Notice>{t("You returned to this goal after")} {Math.max(0, Math.floor((session.attempts[0].createdAt - (parent.completedAt ?? parent.updatedAt)) / 86_400_000))} {t("full days. Compare the answers and situations below; different tasks are not the same test.")}</Notice>}
      {parent?.attempts.at(-1) && allowedTutorAttempt(parent.attempts.at(-1)!, memory.preferences) && <div className="rounded border border-line p-4"><p className="text-xs text-ink-muted">{t("Previous session ·")} {localize(parent.task.situation)}</p><p className="mt-2 text-sm text-ink" lang="en">{parent.attempts.at(-1)!.text}</p><p className="mt-2 text-xs text-ink-muted">{parent.attempts.at(-1)!.supportUsed ? t("With support") : t("No support recorded")} · {new Date(parent.updatedAt).toLocaleDateString(lang === "pt" ? "pt-BR" : "en-US")}</p></div>}
      {session.attempts.map((attempt, i) => <div key={attempt.id} className="rounded border border-line p-4"><p className="text-xs text-ink-muted">{t("Attempt")} {i + 1} · {attempt.supportUsed ? t("with support or feedback") : t("without asking for support")}</p><p className="mt-2 whitespace-pre-wrap text-sm text-ink" lang="en">{attempt.text}</p><p className="mt-2 text-xs text-ink-muted">{attempt.disputed ? t("Assessment disputed") : localize(feedbackLabels[attempt.feedback.status])} {t("· AI:")} {attempt.judge.provider}{attempt.judge.model ? ` / ${attempt.judge.model}` : ""}</p></div>)}
      </Disclosure>
      {reviewAt && !session.revisitedAt && <Notice>{t("Revisit from")} <strong>{new Date(reviewAt).toLocaleDateString(lang === "pt" ? "pt-BR" : "en-US")}</strong>{t(". It will appear in Today so you can try another situation before seeing the example.")}</Notice>}
      {session.revisitedAt && <p className="text-sm text-ink-muted">{t("This goal was revisited on")} {new Date(session.revisitedAt).toLocaleDateString(lang === "pt" ? "pt-BR" : "en-US")}.</p>}
      {last && !last.disputed && last.feedback.status !== "uncertain" && <section className="space-y-3 border-t border-line pt-4"><h3 className="font-medium text-ink">{t("A useful phrase to take away")}</h3><p lang="en" className="text-sm text-ink">{last.feedback.example.english}</p><p className="text-xs text-ink-muted">{t("An example generated by the tutor. It will be saved with its Portuguese meaning and both review directions.")}</p><div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={blocked || !!session.savedPhraseId} onClick={() => void savePhrase()}>{session.savedPhraseId ? t("Phrase saved for review and Anki") : savingPhrase ? t("Saving phrase…") : t("Save this useful phrase")}</Button><Button variant="ghost" disabled={audioLoading} onClick={() => void listen()}>{audioLoading ? t("Generating audio…") : t("Listen to the example")}</Button></div>{session.savedPhraseId && <p className="text-xs text-ink-muted">{t("In Kokoro & Anki, use “Use my saved phrases” to include this phrase in the export.")}</p>}{audioNote && <p role="status" className="text-xs text-ink-muted">{audioNote}</p>}</section>}
      <div className="flex flex-wrap gap-2"><Button onClick={props.onBack} disabled={saving}>{t("Finish for today")}</Button><Button variant="ghost" onClick={onNew} disabled={saving}>{t("Practice something new")}</Button></div>
      <Disclosure title={t("More options")} contentClassName="space-y-3" nested>
      <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={props.onPractice} disabled={saving}>{t("Review my phrases")}</Button><Button variant="ghost" onClick={props.onTools} disabled={saving}>Kokoro & Anki</Button><Button variant="ghost" onClick={props.onConversation}>{t("Have a free conversation")}</Button></div>
      {reviewAt && !session.revisitedAt && !memory.preferences.ignoredEvidenceIds.includes(`session:${session.id}`) && <Button variant="ghost" size="sm" onClick={() => void saveTutorPreferences({ ...memory.preferences, ignoredEvidenceIds: [...memory.preferences.ignoredEvidenceIds, `session:${session.id}`] }).catch(e => setError(String(e)))}>{t("Stop suggesting this revisit")}</Button>}
      </Disclosure>
    </Card>}

    {session.phase !== "complete" && <Disclosure title={t("You can ask the tutor")} open={showHelp} onOpenChange={setShowHelp} contentClassName="space-y-3">
      <p className="text-xs text-ink-muted">{t("Ask for an explanation, an example, or question the correction. This counts as support for your next answer.")}</p>
      {session.help.slice(-3).map((help, i) => <div key={`${help.createdAt}-${i}`} className="space-y-2 border-l-2 border-line pl-3 text-sm"><p className="font-medium text-ink">{t("You:")} {help.question}</p><p className="whitespace-pre-wrap leading-relaxed text-ink-soft">Tutor: {help.answer}</p></div>)}
      <label className="flex flex-col gap-2 text-sm text-ink-soft"><span>{t("Your question")}</span><textarea rows={2} maxLength={600} className={tutorInputClass} value={question} onChange={e => setQuestion(e.target.value)} disabled={blocked} placeholder={t("Why do we use this construction?")} /></label>
      <Button variant="secondary" loading={pendingAction === "help" && helpSource === "question"} disabled={blocked || !selection.providerReady || !question.trim() || session.help.length >= 20} onClick={() => void ask(question)}>{pendingAction === "help" && helpSource === "question" ? t("Preparing an answer…") : t("Ask")}</Button>
      {pendingAction === "help" && helpSource === "question" && <LoadingStatus action={<Button variant="ghost" size="sm" onClick={cancel}>{t("Cancel request")}</Button>}>{t("The tutor is preparing your explanation…")}</LoadingStatus>}
      {session.help.length >= 20 && <p className="text-xs text-ink-muted">{t("Let's pause the explanations. You can finish this session and start another focus.")}</p>}
    </Disclosure>}
    <div className="flex flex-wrap gap-2">
      {(memory.observations.length > 0 || session.attempts.length > 0) && <Button variant="ghost" disabled={blocked} aria-expanded={showMemory} aria-controls="active-tutor-memory" onClick={() => void revealMemory()}>{t("What my tutor remembers")}</Button>}
      {session.phase === "practice" && <Button variant="ghost" disabled={blocked} onClick={() => void finish()}>{t("Finish this focus")}</Button>}
    </div>
    {session.phase !== "complete" && <Disclosure title={t("AI settings")} nested><ProviderPicker selection={selection} disabled={blocked} /></Disclosure>}
    {showMemory && <div id="active-tutor-memory"><TutorMemoryPanel memory={memory} /></div>}
  </div>;
}
