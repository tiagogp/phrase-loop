"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getReviewModelPreference, resolveReviewSelection, subscribeToReviewModel } from "@/features/converse/reviewModel";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Field, Input } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Spinner } from "@/components/ui/Spinner";
import { Notice } from "@/components/ui/Notice";
import { cn } from "@/lib/cn";
import { useT } from "@/i18n/I18nProvider";
import { normalizeContext } from "@/lib/cards/context";
import type { ConversationTurn } from "@/lib/cards/provider";
import {
  deleteConversation,
  getConversationGaps,
  getConversations,
  saveConversation,
  saveConversationGaps,
  type Conversation,
} from "@/lib/store/repository";
import {
  closeGap,
  gapForms,
  gapsClosedByTurn,
  knownPatternLabels,
  partitionOpenGaps,
  planNextTurn,
  recordReviewedGaps,
  type ConversationGap,
} from "@/features/converse/gaps";
import { useProviderSelection } from "@/features/cards/hooks/useProviderSelection";
import { getLearnerLangs } from "@/features/settings/learningProfile";
import { transcribeAudio } from "@/features/correct/api";
import { requestGapReview, sendConversationTurn, synthesizeSpeech } from "@/features/converse/api";
import { LongSessionReview } from "@/features/converse/components/LongSessionReview";
import { createMediaRun } from "@/features/converse/mediaRun";
import { mergeRepertoire, parseRepertoire, recentTaughtExpressions, segmentRepertoire, type RepertoireItem } from "@/features/converse/repertoire";
import { useClipRecorder } from "@/features/converse/useClipRecorder";
import LocalModelNotice from "@/features/speech/components/LocalModelNotice";
import { useWhisperModel } from "@/features/speech/hooks/useLocalModel";
import {
  aiTurnCount,
  codeSwitchTurn,
  endDisposition,
  formatRemaining,
  isTimeUp,
  LONG_SESSION_DURATIONS,
  MIN_CODE_SWITCH_MS,
  pauseClock,
  pendingCodeSwitch,
  recordIntroduced,
  remainingMs,
  resumeClock,
  startClock,
  timeUpAction,
  type LongSessionDuration,
  type LongSessionTopic,
} from "@/features/converse/longSession";

const FREE_TOPIC = "free";

export interface LongSessionProps {
  active?: boolean;
  onOpenSettings?: () => void;
  /** Scenarios from the learner's domain profile; a free topic is always available. */
  topics?: LongSessionTopic[];
  /** Opens a tutor situation from a phrase saved out of a gap. */
  onPracticeSource?: (cardId: string) => void;
}

/**
 * Experimental long session (B1+): 5 or 10 minutes with no turn limit and no correction while it
 * runs. The partner keeps the demand when the learner gets stuck; the review comes at the end.
 */
export default function LongSession({ active = true, onOpenSettings, topics = [], onPracticeSource }: LongSessionProps) {
  const { t } = useT();
  const selection = useProviderSelection({ fallbackToEvaluator: true });
  const { provider, activeProvider, hasEvaluator, selectedModel } = selection;
  // The review may use a different (usually larger) model than the conversation; default: same.
  const reviewPreference = useSyncExternalStore(subscribeToReviewModel, () => JSON.stringify(getReviewModelPreference()), () => "{}");
  const reviewer = resolveReviewSelection(JSON.parse(reviewPreference), { provider, model: provider === "ollama" ? selectedModel : undefined },
    selection.providers, selection.ollamaModels);
  const whisper = useWhisperModel();
  const [topicId, setTopicId] = useState<string>(() => topics[0]?.id ?? FREE_TOPIC);
  const [customTopic, setCustomTopic] = useState("");
  const [duration, setDuration] = useState<LongSessionDuration>(10);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [finished, setFinished] = useState<Conversation | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewNote, setReviewNote] = useState<string | null>(null);
  const [past, setPast] = useState<Conversation[]>([]);
  const [gaps, setGaps] = useState<ConversationGap[]>([]);
  const gapsRef = useRef<ConversationGap[]>([]);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const conversationRef = useRef<Conversation | null>(null);
  const mediaRun = useRef(createMediaRun());
  const requestRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const spokenRef = useRef(false);
  const mic = useClipRecorder(active);
  // "Travei": a second recorder, held down while the learner says it in Portuguese.
  const stuck = useClipRecorder(active);
  const holdingRef = useRef(false);
  const [stuckTranscribing, setStuckTranscribing] = useState(false);
  const [typingPortuguese, setTypingPortuguese] = useState(false);
  const [portuguese, setPortuguese] = useState("");

  const level = getLearnerLangs().level;
  const topic = topics.find((item) => item.id === topicId);
  const freeTrimmed = customTopic.trim();
  const canStart = hasEvaluator && (topicId === FREE_TOPIC ? freeTrimmed.length > 0 : Boolean(topic));
  const running = conversation?.longSession?.runningSince !== undefined;

  const refreshPast = useCallback(async () => {
    try {
      const [all, storedGaps] = await Promise.all([getConversations(), getConversationGaps()]);
      gapsRef.current = storedGaps;
      setGaps(storedGaps);
      setPast(all.filter((item) => item.mode === "long").sort((a, b) => b.startedAt - a.startedAt));
    } catch {
      /* store unavailable — the list stays empty */
    }
  }, []);
  useEffect(() => {
    const load = async () => {
      await refreshPast();
    };
    void load();
  }, [refreshPast]);

  /** Merge changed gaps into the registry and store them. */
  const storeGaps = useCallback((changed: ConversationGap[]) => {
    if (changed.length === 0) return;
    const byId = new Map(gapsRef.current.map((gap) => [gap.id, gap]));
    for (const gap of changed) byId.set(gap.id, gap);
    gapsRef.current = [...byId.values()];
    setGaps(gapsRef.current);
    void saveConversationGaps(changed).catch(() => undefined);
  }, []);

  const persist = useCallback((next: Conversation) => {
    conversationRef.current = next;
    setConversation(next);
    void saveConversation(next);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.turns.length, busy]);

  const stopAudio = useCallback(() => {
    mediaRun.current.cancel();
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.pause();
    }
  }, []);

  useEffect(() => () => {
    requestRef.current += 1;
    stopAudio();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
  }, [stopAudio]);

  const playReply = useCallback(async (text: string) => {
    const run = mediaRun.current.start();
    try {
      const blob = await synthesizeSpeech(text, run.signal);
      if (!run.current()) return;
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = URL.createObjectURL(blob);
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = audioUrlRef.current;
      await audioRef.current.play();
    } catch {
      /* audio is optional; the text is already on screen */
    }
  }, []);

  const saveFinished = useCallback((next: Conversation) => {
    setFinished(next);
    void saveConversation(next).then(refreshPast);
  }, [refreshPast]);

  /** Runs once per session; reopening shows the stored review instead of re-charging the provider. */
  const runReview = useCallback(async (target: Conversation) => {
    if (!target.longSession) return;
    setReviewing(true);
    setReviewNote(null);
    const sessionTopic = topics.find((item) => item.id === target.longSession?.scenarioId);
    try {
      const { review, judge } = await requestGapReview({
        provider: reviewer.provider,
        selectedModel: reviewer.model,
        turns: target.turns,
        level: target.level,
        scenario: target.scenario,
        functions: sessionTopic?.functions?.map((item) => ({ id: item.id, label: item.label })),
        knownPatternLabels: knownPatternLabels(gapsRef.current),
      });
      const reviewedAt = Date.now();
      // Re-running a review never counts the same session twice (see recordReviewedGaps).
      storeGaps(recordReviewedGaps(gapsRef.current, review.gaps, { id: target.id, startedAt: target.startedAt, scenarioId: target.longSession.scenarioId }, reviewedAt));
      saveFinished({ ...target, longSession: { ...target.longSession, review: { ...review, reviewedAt, judge } } });
    } catch (err: unknown) {
      setReviewNote(err instanceof Error ? err.message : t("Couldn't review the conversation."));
    } finally {
      setReviewing(false);
    }
  }, [reviewer.model, reviewer.provider, saveFinished, storeGaps, t, topics]);

  const openReview = useCallback((target: Conversation) => {
    setFinished(target);
    setReviewNote(null);
    if (!target.longSession?.review) void runReview(target);
  }, [runReview]);

  /** End the session: a session where the learner never spoke is dropped without review. */
  const finish = useCallback((endedBy: "time" | "learner") => {
    const current = conversationRef.current;
    if (!current?.longSession) return;
    requestRef.current += 1;
    setBusy(false);
    stopAudio();
    mic.cancel();
    stuck.cancel();
    const endedAt = Date.now();
    conversationRef.current = null;
    setConversation(null);
    setTyped("");
    if (endDisposition(current.turns) === "discard") {
      void deleteConversation(current.id).then(refreshPast);
      setNote(t("The session ended before you spoke, so there is nothing to review."));
      return;
    }
    const ended: Conversation = { ...current, endedAt, longSession: { ...pauseClock(current.longSession, endedAt), endedBy } };
    void saveConversation(ended).then(refreshPast);
    openReview(ended);
  }, [mic, openReview, refreshPast, stopAudio, stuck, t]);

  const requestReply = useCallback(async (base: Conversation) => {
    const long = base.longSession;
    if (!long) return;
    const request = ++requestRef.current;
    setBusy(true);
    setNote(null);
    const sessionTopic = topics.find((item) => item.id === long.scenarioId);
    const nextAiTurn = aiTurnCount(base.turns);
    const session = { id: base.id, startedAt: base.startedAt, scenarioId: long.scenarioId };
    // Open gaps first; new expressions only when no gap is waiting to be pulled.
    const plan = planNextTurn({ gaps: gapsRef.current, session, pulls: long.gapPulls, closedHere: long.closedGapIds, nextAiTurn, pacing: long.pacing, level: base.level });
    const budget = plan.newExpressionBudget;
    const taught = [...recentTaughtExpressions(past), ...(base.repertoire ?? []).map((item) => item.expression)];
    try {
      const { reply } = await sendConversationTurn({
        provider,
        selectedModel,
        scenario: base.scenario,
        targetLang: base.targetLang,
        level: base.level,
        history: base.turns,
        taughtExpressions: taught,
        longSession: {
          aiRole: sessionTopic?.aiRole,
          functions: sessionTopic?.functions?.map((item) => item.label),
          codeSwitch: pendingCodeSwitch(base.turns),
          elicitGap: plan.gap ? { intent: plan.gap.intent, natural: gapForms(plan.gap)[0] } : undefined,
          newExpressionBudget: budget,
          suggestedExpressions: sessionTopic?.expressions?.filter((expression) => !taught.includes(expression)).slice(0, 6),
        },
      });
      if (request !== requestRef.current || !reply) return;
      const parsed = parseRepertoire(reply);
      const latest = conversationRef.current ?? base;
      const repertoire: RepertoireItem[] = mergeRepertoire(latest.repertoire ?? [], parsed.items);
      const latestLong = latest.longSession!;
      persist({
        ...latest,
        turns: [...latest.turns, { role: "assistant", text: parsed.display, at: Date.now() }],
        repertoire,
        longSession: {
          ...latestLong,
          pacing: recordIntroduced(latestLong.pacing, nextAiTurn, parsed.items.length, budget),
          gapPulls: plan.gap ? { ...latestLong.gapPulls, [plan.gap.id]: (latestLong.gapPulls?.[plan.gap.id] ?? 0) + 1 } : latestLong.gapPulls,
        },
      });
      void playReply(parsed.plain);
    } catch (err: unknown) {
      if (request === requestRef.current) setNote(err instanceof Error ? err.message : t("Couldn't get a reply."));
    } finally {
      if (request === requestRef.current) setBusy(false);
    }
  }, [past, persist, playReply, provider, selectedModel, t, topics]);

  const start = useCallback(async () => {
    if (!canStart || busy) return;
    const startedAt = Date.now();
    const chosen = topicId === FREE_TOPIC ? undefined : topic;
    const scenario = chosen?.situation ?? freeTrimmed;
    const conv: Conversation = {
      id: crypto.randomUUID(),
      scenario,
      context: chosen?.label ?? normalizeContext(freeTrimmed) ?? "conversation",
      targetLang: getLearnerLangs().targetLang,
      sourceLang: getLearnerLangs().nativeLang,
      level,
      turns: [],
      repertoire: [],
      startedAt,
      mode: "long",
      longSession: { ...startClock(duration, startedAt), scenarioId: chosen?.id, profileId: chosen?.profileId, label: chosen?.label, pacing: { introduced: 0 } },
    };
    setFinished(null);
    setNow(startedAt);
    persist(conv);
    await requestReply(conv);
  }, [busy, canStart, duration, freeTrimmed, level, persist, requestReply, topic, topicId]);

  const pause = useCallback(() => {
    const current = conversationRef.current;
    if (!current?.longSession) return;
    requestRef.current += 1;
    setBusy(false);
    stopAudio();
    mic.cancel();
    stuck.cancel();
    persist({ ...current, longSession: pauseClock(current.longSession, Date.now()) });
  }, [mic, persist, stopAudio, stuck]);

  const resume = useCallback((target: Conversation) => {
    if (!target.longSession) return;
    const at = Date.now();
    setFinished(null);
    setNote(null);
    setNow(at);
    // A record still "running" was left without a pause (app closed): count only up to its last turn.
    const lastActivity = target.turns.at(-1)?.at ?? target.longSession.runningSince ?? at;
    const paused = target.id === conversationRef.current?.id ? target.longSession : pauseClock(target.longSession, Math.min(lastActivity, at));
    persist({ ...target, endedAt: undefined, longSession: resumeClock(paused, at) });
  }, [persist]);

  // Leaving the workspace pauses the clock: the session is kept, not lost.
  useEffect(() => {
    mediaRun.current.setActive(active);
    if (!active && conversationRef.current?.longSession?.runningSince !== undefined) pause();
  }, [active, pause]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [running]);

  const timeUp = Boolean(conversation?.longSession && running && isTimeUp(conversation.longSession, now));
  const turnInProgress = mic.recording || transcribing || stuck.recording || stuckTranscribing
    || typed.trim().length > 0 || portuguese.trim().length > 0;
  useEffect(() => {
    if (timeUpAction({ timeUp, turnInProgress }) === "review") finish("time");
  }, [finish, timeUp, turnInProgress]);

  const sendTurn = useCallback(async (text: string, extra: Partial<ConversationTurn> = {}) => {
    const trimmed = text.trim();
    const current = conversationRef.current;
    if (!trimmed || !current?.longSession || current.longSession.runningSince === undefined) return;
    const at = Date.now();
    // Using a gap's natural form unaided, on a later day, closes it. Nothing is said mid-session.
    const closed = extra.codeSwitch ? [] : gapsClosedByTurn({
      text: trimmed,
      gaps: gapsRef.current,
      session: { id: current.id, startedAt: current.startedAt },
      previousAiTurns: current.turns.filter((turn) => turn.role === "assistant").map((turn) => turn.text),
    });
    storeGaps(closed.map((gap) => closeGap(gap, { id: current.id, startedAt: current.startedAt }, at, trimmed)));
    const withUser: Conversation = {
      ...current,
      turns: [...current.turns, { role: "user", text: trimmed, at, ...extra }],
      longSession: closed.length > 0
        ? { ...current.longSession, closedGapIds: [...(current.longSession.closedGapIds ?? []), ...closed.map((gap) => gap.id)] }
        : current.longSession,
    };
    persist(withUser);
    setTyped("");
    spokenRef.current = false;
    // Time already ran out: this was the turn allowed to finish. No further reply.
    if (isTimeUp(current.longSession, at)) {
      finish("time");
      return;
    }
    await requestReply(withUser);
  }, [finish, persist, requestReply, storeGaps]);

  const toggleMic = useCallback(async () => {
    if (mic.recording) {
      const clip = await mic.stop();
      if (!clip) return;
      setTranscribing(true);
      try {
        const text = await transcribeAudio(clip.blob);
        if (!text) setNote(t("Couldn't make out any speech in that clip."));
        else {
          spokenRef.current = true;
          setTyped((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
        }
      } catch (err: unknown) {
        setNote(err instanceof Error ? err.message : t("Transcription failed."));
      } finally {
        setTranscribing(false);
      }
      return;
    }
    setNote(null);
    try {
      await mic.start();
    } catch {
      setNote(t("Couldn't access the microphone. Check the browser's permission."));
    }
  }, [mic, t]);

  const startStuck = useCallback(async () => {
    if (holdingRef.current || mic.recording) return;
    holdingRef.current = true;
    stopAudio();
    setNote(null);
    try {
      const started = await stuck.start();
      // Released before the mic opened: that was a tap, not a stretch of speech.
      if (started && !holdingRef.current) await stuck.stop();
    } catch {
      holdingRef.current = false;
      setNote(t("Couldn't access the microphone. Type it in Portuguese instead."));
      setTypingPortuguese(true);
    }
  }, [mic.recording, stopAudio, stuck, t]);

  const releaseStuck = useCallback(async () => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    const clip = await stuck.stop();
    if (!clip) return;
    if (clip.durationMs < MIN_CODE_SWITCH_MS) {
      setNote(t("Hold the button while you say it in Portuguese."));
      return;
    }
    setStuckTranscribing(true);
    try {
      // Forced Portuguese: in auto mode Whisper may render this stretch as English or translate it.
      const text = await transcribeAudio(clip.blob, undefined, { language: "pt" });
      if (!text) {
        setNote(t("Couldn't make out that stretch. Type it in Portuguese instead."));
        setTypingPortuguese(true);
        return;
      }
      const turn = codeSwitchTurn(text, "voice", Date.now(), clip.durationMs);
      await sendTurn(turn.text, turn);
    } catch (err: unknown) {
      setNote(err instanceof Error ? err.message : t("Transcription failed."));
      setTypingPortuguese(true);
    } finally {
      setStuckTranscribing(false);
    }
  }, [sendTurn, stuck, t]);

  const sendPortuguese = useCallback(async () => {
    const text = portuguese.trim();
    if (!text) return;
    setPortuguese("");
    const turn = codeSwitchTurn(text, "typed", Date.now());
    await sendTurn(turn.text, turn);
  }, [portuguese, sendTurn]);

  const openGaps = partitionOpenGaps(gaps);
  const cloudNote = activeProvider && !activeProvider.isLocal
    ? t("Your turns are sent to {provider} to generate replies.", { provider: activeProvider.label })
    : null;

  // ───────────────────────── review ─────────────────────────
  if (finished) {
    return (
      <LongSessionReview
        conversation={finished}
        topic={topics.find((item) => item.id === finished.longSession?.scenarioId)}
        registry={gaps}
        reviewing={reviewing}
        reviewerNote={[
          reviewer.fellBack ? t("The AI chosen for reviews is unavailable, so this review uses the conversation's AI.") : "",
          !reviewer.isLocal ? t("The whole conversation is sent to {provider} for the review.", { provider: reviewer.label }) : "",
        ].filter(Boolean).join(" ") || null}
        note={reviewNote}
        onRetry={() => void runReview(finished)}
        onUpdate={saveFinished}
        onDone={() => setFinished(null)}
        onPracticeSource={onPracticeSource}
      />
    );
  }

  // ───────────────────────── setup ─────────────────────────
  if (!conversation) {
    return (
      <div className="space-y-5">
        <Card className="space-y-4 p-5">
          <div>
            <p className="text-sm font-semibold tracking-[-0.01em] text-ink">{t("Long session")} <span className="ml-1 rounded border border-line px-1.5 py-0.5 text-[0.65rem] font-medium text-ink-muted">{t("Experimental")}</span></p>
            <p className="mt-0.5 text-xs text-ink-muted">
              {t("Talk for 5 or 10 minutes. Nothing is corrected while you talk, and your partner will not make the question easier when you get stuck. At the end you see what you could not say yet.")}
            </p>
          </div>

          <Field group label={t("Topic")}>
            <div className="flex flex-wrap gap-1.5">
              {topics.map((item) => (
                <Chip key={item.id} active={topicId === item.id} onClick={() => setTopicId(item.id)}>{item.label}</Chip>
              ))}
              <Chip active={topicId === FREE_TOPIC} onClick={() => setTopicId(FREE_TOPIC)}>{t("Free topic")}</Chip>
            </div>
          </Field>
          {topic && <p className="text-xs text-ink-soft">{topic.displaySituation ?? topic.situation}</p>}
          {topicId === FREE_TOPIC && (
            <Field label={t("What do you want to talk about?")}>
              <Input type="text" value={customTopic} onChange={(event) => setCustomTopic(event.target.value)}
                placeholder={t("e.g. explaining why the release slipped")} />
            </Field>
          )}

          <Field group label={t("Duration")}>
            <Segmented<`${LongSessionDuration}`>
              label={t("Duration")}
              value={`${duration}`}
              onChange={(value) => setDuration(Number(value) as LongSessionDuration)}
              options={LONG_SESSION_DURATIONS.map((minutes) => ({ value: `${minutes}`, label: t("{count} min", { count: minutes }) }))}
            />
          </Field>

          {openGaps.active.length > 0 && (
            <p className="text-xs text-ink-soft">
              {t("{count} open gaps will come back in the conversation when they are at least a day old.", { count: openGaps.active.length })}
              {openGaps.frozen.length > 0 && ` ${t("{count} older ones wait until one closes.", { count: openGaps.frozen.length })}`}
            </p>
          )}
          {cloudNote && <p className="text-xs text-ink-muted">{cloudNote}</p>}
          {note && <p role="status" className="text-xs text-ink-muted">{note}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" className="h-10" onClick={() => void start()} disabled={!canStart || busy}>
              {busy ? t("Starting…") : t("Start long session →")}
            </Button>
            {!hasEvaluator && onOpenSettings && (
              <button onClick={onOpenSettings} className="text-xs text-ink-muted underline hover:no-underline">{t("Open Settings →")}</button>
            )}
          </div>
        </Card>

        {past.length > 0 && (
          <Card className="p-5">
            <p className="mb-3 text-sm font-semibold tracking-[-0.01em] text-ink">{t("Recent long sessions")}</p>
            <ul className="space-y-2">
              {past.slice(0, 6).map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface/50 p-3 sm:gap-3">
                  <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
                    <p className="truncate text-sm text-ink">{item.longSession?.label ?? item.context}</p>
                    <p className="text-xs text-ink-muted">
                      {new Date(item.startedAt).toLocaleDateString()}
                      {item.endedAt ? "" : ` · ${t("paused · {time} left", { time: formatRemaining(item.longSession ? remainingMs(item.longSession, now) : 0) })}`}
                    </p>
                  </div>
                  {item.endedAt
                    ? <Chip onClick={() => openReview(item)}>{t("Review")}</Chip>
                    : <Chip onClick={() => resume(item)}>{t("Resume")}</Chip>}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    );
  }

  // ───────────────────────── active ─────────────────────────
  const long = conversation.longSession!;
  const left = remainingMs(long, now);
  return (
    <Card className="flex h-[max(32rem,calc(100dvh-12rem))] flex-col overflow-hidden border-line-strong sm:h-[max(32rem,calc(100dvh-13rem))]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold tracking-[-0.01em] text-ink">{long.label ?? conversation.context}</p>
          <p className="text-xs text-ink-muted">{t("Long session")} · {t("Experimental")}</p>
        </div>
        <div className="flex items-center gap-2">
          <span role="timer" aria-label={t("Time left")} className={cn("font-mono text-lg tabular-nums", left < 60_000 ? "text-accent" : "text-ink")}>
            {formatRemaining(left)}
          </span>
          {running
            ? <Button variant="secondary" className="h-9" onClick={pause}>{t("Pause")}</Button>
            : <Button variant="primary" className="h-9" onClick={() => resume(conversation)}>{t("Resume")}</Button>}
          <Button variant="ghost" className="h-9" onClick={() => finish("learner")}>{t("Finish")}</Button>
        </div>
      </div>

      <ul className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-card px-4 py-5 app-scroll-region sm:px-6" aria-live="polite">
        {conversation.turns.map((turn, index) => (
          <LongSessionBubble key={index} turn={turn} items={conversation.repertoire ?? []} />
        ))}
        {busy && (
          <li className="flex items-center gap-2 text-xs text-ink-muted"><Spinner className="h-3.5 w-3.5" /> {t("Thinking…")}</li>
        )}
        <div ref={bottomRef} />
      </ul>

      <div className="shrink-0 space-y-2 border-t border-line bg-surface p-3 sm:p-4">
        {!running && <Notice>{t("Paused. The timer stops while paused; resume when you are ready.")}</Notice>}
        {timeUp && <Notice tone="warning">{t("Time is up. Finish your sentence and send it; the review comes next.")}</Notice>}
        {note && <p className="text-xs text-danger">{note}</p>}
        <LocalModelNotice model={whisper} />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            aria-label={t("Hold to say it in Portuguese")}
            disabled={!running || busy || stuckTranscribing || mic.recording || transcribing}
            className={cn("min-h-11 touch-none select-none whitespace-normal text-left", stuck.recording && "border-accent text-accent")}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture?.(event.pointerId);
              void startStuck();
            }}
            onPointerUp={() => void releaseStuck()}
            onPointerCancel={() => void releaseStuck()}
            onKeyDown={(event) => {
              if ((event.key === " " || event.key === "Enter") && !event.repeat) {
                event.preventDefault();
                void startStuck();
              }
            }}
            onKeyUp={(event) => {
              if (event.key === " " || event.key === "Enter") void releaseStuck();
            }}
          >
            {stuckTranscribing ? <Spinner className="h-4 w-4" /> : stuck.recording ? t("Speaking Portuguese… release to send") : t("I'm stuck · hold to say it in Portuguese")}
          </Button>
          <button type="button" className="text-xs text-ink-muted underline hover:no-underline" disabled={!running}
            onClick={() => setTypingPortuguese((open) => !open)}>
            {typingPortuguese ? t("Hide") : t("Type it in Portuguese")}
          </button>
        </div>
        {typingPortuguese && (
          <div className="flex gap-2">
            <Input
              type="text"
              lang="pt"
              value={portuguese}
              onChange={(event) => setPortuguese(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void sendPortuguese();
                }
              }}
              placeholder={t("What you wanted to say, in Portuguese")}
              aria-label={t("What you wanted to say, in Portuguese")}
              disabled={!running || busy}
              className="h-10 flex-1"
            />
            <Button variant="secondary" className="h-10" disabled={!running || busy || !portuguese.trim()} onClick={() => void sendPortuguese()}>
              {t("Send")}
            </Button>
          </div>
        )}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
          <Button variant="secondary" onClick={() => void toggleMic()} disabled={!running || transcribing || stuck.recording}
            className={cn("col-span-2 min-h-11 shrink-0 sm:col-span-1", mic.recording && "border-danger text-danger")}>
            {transcribing ? <Spinner className="h-4 w-4" /> : mic.recording ? t("Stop") : t("Speak")}
          </Button>
          <Input
            type="text"
            value={typed}
            onChange={(event) => {
              spokenRef.current = false;
              setTyped(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendTurn(typed, { spoken: spokenRef.current });
              }
            }}
            placeholder={t("Type your reply, or tap Speak…")}
            aria-label={t("Your answer")}
            disabled={!running || busy}
            className="h-11 min-w-0 flex-1"
          />
          <Button variant="primary" className="h-11 shrink-0 sm:min-w-24" disabled={!running || busy || !typed.trim()}
            onClick={() => void sendTurn(typed, { spoken: spokenRef.current })}>
            {t("Send")}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function LongSessionBubble({ turn, items }: { turn: ConversationTurn; items: RepertoireItem[] }) {
  const { t } = useT();
  const isUser = turn.role === "user";
  const parsed = isUser ? null : parseRepertoire(turn.text);
  const glosses = new Map(items.map((item) => [item.expression.toLowerCase(), item.gloss]));
  const marked = (parsed?.items ?? []).map((item) => ({ ...item, gloss: item.gloss || glosses.get(item.expression.toLowerCase()) || "" }));
  return (
    <li className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div className={cn(
        "min-w-0 max-w-[92%] whitespace-pre-wrap [overflow-wrap:anywhere] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm sm:max-w-[76%]",
        isUser ? "rounded-br-md bg-off-black text-white" : "rounded-bl-md border border-line bg-surface text-ink",
        turn.codeSwitch && "border border-dashed border-accent/60 bg-accent/10 text-ink",
      )}>
        {turn.codeSwitch && <p className="mb-1 text-[0.65rem] font-medium uppercase tracking-wide text-accent">{t("In Portuguese")}</p>}
        {parsed && marked.length > 0
          ? segmentRepertoire(parsed.display, marked).map((segment, index) => segment.item
            ? <span key={index} title={segment.item.gloss || undefined} className="rounded-sm bg-accent/12 px-0.5 font-medium">{segment.text}</span>
            : <span key={index}>{segment.text}</span>)
          : (parsed?.plain ?? turn.text)}
      </div>
    </li>
  );
}
