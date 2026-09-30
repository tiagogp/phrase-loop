"use client";

import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { useT } from "@/i18n/I18nProvider";
import { useStudySession } from "../useStudySession";
import { StudyCard } from "./StudyCard";
import { PerformanceStats } from "./PerformanceStats";
import { WeaknessList } from "./WeaknessList";
import { SavedCardsBrowser } from "./SavedCardsBrowser";
import { TransferPracticeCard } from "./TransferPracticeCard";
import { PatternDrillCard } from "./PatternDrillCard";
import { RetentionProofCard } from "./RetentionProofCard";
import { UnpreparedQuestion } from "./UnpreparedQuestion";
import { ColdListeningProbe } from "@/features/listening/components/ColdListeningProbe";
import { ReadinessCoach } from "@/features/levelup/components/ReadinessCoach";
import Disclosure from "@/components/ui/Disclosure";
import { DEFAULT_LEARNING_PROFILE, getLearningProfile, subscribeToProfile } from "@/features/settings/learningProfile";
import { ReviewWorkspaceNav, type ReviewView } from "./ReviewWorkspaceNav";

export default function StudyTab({ onDiscover, onConversation, onLesson, onCorrect, onProgress, onOpenSettings, view, onViewChange, reviewRequest = 0 }: {
  onDiscover?: () => void;
  onConversation?: () => void;
  onLesson?: () => void;
  onCorrect?: () => void;
  onProgress?: () => void;
  onOpenSettings?: () => void;
  view?: ReviewView;
  onViewChange?: (view: ReviewView) => void;
  reviewRequest?: number;
}) {
  const { t } = useT();
  const session = useStudySession(reviewRequest);
  const [localView, setLocalView] = useState<ReviewView>("review");
  const activeView = view ?? localView;
  const setActiveView = onViewChange ?? setLocalView;
  const [extraPractice, setExtraPractice] = useState(false);
  const [transferComplete, setTransferComplete] = useState(false);
  const [actionError, setActionError] = useState(false);
  const level = useSyncExternalStore(subscribeToProfile, () => getLearningProfile().level, () => DEFAULT_LEARNING_PROFILE.level);
  const { counts, current, queue, sessionResults } = session;
  const ended = queue.length === 0 && sessionResults.length > 0;
  const run = (action: () => Promise<unknown>) => {
    setActionError(false);
    void action().catch(() => setActionError(true));
  };

  if (session.loading) return <p role="status" className="text-sm text-ink-muted">{t("Loading…")}</p>;
  if (!session.available) return <Notice tone="error">{t("Local storage isn't available in this browser, so studying is disabled.")}</Notice>;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow={t("Remember, then use")} title={t("Phrases")}
        description={t("A short review, one answer of your own, and a clear place to stop.")}
        aside={<span className="rounded-lg border border-line bg-card px-3 py-2 text-xs text-ink-muted">{t("{count} due in your library", { count: counts.due })}</span>} />
      <ReviewWorkspaceNav value={activeView} due={counts.due} hasPractice={session.reviews.length > 0} onChange={setActiveView} />
      {(session.sessionError || actionError) && <Notice tone="error">
        {session.sessionError ?? t("Could not load your practice history.")}
        {!current && <Button variant="ghost" onClick={() => run(session.retryLoad)}>{t("Try again")}</Button>}
      </Notice>}

      {activeView === "review" && <section id="review-view-panel-review" role="tabpanel" aria-labelledby="review-view-tab-review" className="space-y-5">
        {current && <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
            <p>{t("Phrase {current} of {total} in this session", { current: sessionResults.length + 1, total: sessionResults.length + queue.length })}</p>
            <Button variant="ghost" size="sm" onClick={session.stopSession} disabled={session.grading}>{t("Pause here")}</Button>
          </div>
          <progress className="h-1.5 w-full accent-accent" aria-label={t("Session progress")} value={sessionResults.length} max={sessionResults.length + queue.length} />
        </div>}
        {session.reinforcing && <Notice>{t("Reinforcing")} {session.reinforcing.label}</Notice>}
        {session.cooldown && <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="max-w-lg text-sm text-ink-soft">{t("This is getting effortful. Keep what you practiced and take a break, or continue when you feel ready.")}</p>
          <Button variant="secondary" onClick={session.stopSession} disabled={session.grading}>{t("Pause here")}</Button>
        </Card>}
        {(current || sessionResults.length > 0 || (counts.cards > 0 && counts.due === 0)) && <StudyCard totalCards={counts.cards} current={current} queueLength={queue.length}
          flipped={session.flipped} grading={session.grading} sessionResults={sessionResults}
          tomorrow={session.tomorrow} reviews={session.reviews} transferRequired={false} transferComplete={false}
          onFlip={session.flip} onGrade={(grade, scaffold) => void session.grade(grade, scaffold)}
          onDiscover={onDiscover ?? (() => {})} />}
        {(ended || !current) && <Card className="space-y-3 border-accent/25 p-5">
          <h2 className="text-lg font-semibold text-ink">{t(counts.cards > 0 ? "Take one idea beyond the card" : "Give your practice a starting point")}</h2>
          <p className="max-w-xl text-sm leading-relaxed text-ink-soft">{t(counts.cards > 0 ? "Try one new sentence with something you saved. You can use support and try again after feedback." : "Start a guided lesson or bring something you want to understand.")}</p>
          <div className="flex flex-wrap gap-2">
            {counts.cards > 0 ? <Button variant="primary" onClick={() => { setTransferComplete(false); setActiveView("use"); }}>{t("Use what I learned")}</Button>
              : onLesson && <Button variant="primary" onClick={onLesson}>{t("Start first lesson")}</Button>}
            {counts.cards === 0 && onDiscover && <Button variant="ghost" onClick={onDiscover}>{t("Add content")}</Button>}
            {onProgress && ended && <Button variant="secondary" onClick={onProgress}>{t("See my progress")}</Button>}
            {counts.due > 0 && <Button variant="ghost" onClick={() => { setTransferComplete(false); run(session.startReview); }}>{t("Another short review")}</Button>}
          </div>
          {counts.due > 0 && ended && <p className="text-xs text-ink-muted">{t("{count} phrases are still due. You can return to them in another short session.", { count: counts.due })}</p>}
        </Card>}
      </section>}

      {activeView === "use" && <section id="review-view-panel-use" role="tabpanel" aria-labelledby="review-view-tab-use" className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-ink">{t("One idea, a new situation")}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t("Try first. Read the feedback. Then change what needs attention.")}</p>
        </div>
        {transferComplete ? <Card className="space-y-3 p-6">
          <h3 className="text-lg font-semibold text-ink">{t("You put your English to work")}</h3>
          <p className="text-sm leading-relaxed text-ink-soft">{t("Your attempt is saved. A later review will help you see what you can do again without help.")}</p>
          <div className="flex flex-wrap gap-2">
            {onProgress && <Button variant="primary" onClick={onProgress}>{t("See my progress")}</Button>}
            <Button variant="ghost" onClick={() => setTransferComplete(false)}>{t("Try another situation")}</Button>
          </div>
        </Card> : counts.cards > 0 ? <TransferPracticeCard onCompleted={() => setTransferComplete(true)} onOpenSettings={onOpenSettings} />
          : <Card className="space-y-3 p-5"><p className="text-sm text-ink-soft">{t("Save a phrase from a lesson or your own content to practice it here.")}</p>{onLesson && <Button variant="primary" onClick={onLesson}>{t("Start first lesson")}</Button>}</Card>}
        <div className="flex flex-wrap gap-2">
          {onConversation && <Button variant="secondary" onClick={onConversation}>{t("Use it in conversation")}</Button>}
          {onCorrect && <Button variant="ghost" onClick={onCorrect}>{t("Work on a correction")}</Button>}
          {counts.cards > 0 && <Button variant="ghost" onClick={() => setExtraPractice(!extraPractice)} aria-expanded={extraPractice} aria-controls="extra-practice">{t("More ways to practice")}</Button>}
        </div>
        {extraPractice && <div id="extra-practice" className="space-y-5"><PatternDrillCard /><UnpreparedQuestion level={level} /></div>}
      </section>}

      {activeView === "progress" && <section id="review-view-panel-progress" role="tabpanel" aria-labelledby="review-view-tab-progress" className="space-y-5">
        <div><h2 className="text-lg font-semibold text-ink">{t("Give the difficult parts a little attention")}</h2><p className="mt-1 text-sm text-ink-muted">{t("Practice one recurring difficulty, or check what you remember after a delay.")}</p></div>
        <WeaknessList weaknesses={session.weaknesses} genError={session.genError} generatingKey={session.generatingKey}
          onPractice={(weakness) => { setActiveView("review"); run(() => session.startReinforcement(weakness)); }}
          onGenerate={(weakness) => run(async () => { if (await session.generateReinforcement(weakness)) setActiveView("review"); })} />
        <Disclosure title={t("Check what stayed")} description={t("Recall after a delay and listening checks, when you need them.")}><RetentionProofCard /><ColdListeningProbe /></Disclosure>
        <Disclosure title={t("Readiness for the next level")}>
          <ReadinessCoach weaknesses={session.weaknesses} generatingKey={session.generatingKey}
            onPractice={(weakness) => { setActiveView("review"); run(() => session.startReinforcement(weakness)); }}
            onGenerate={(weakness) => run(async () => { if (await session.generateReinforcement(weakness)) setActiveView("review"); })} />
        </Disclosure>
        <Disclosure title={t("Show detailed stats")}><PerformanceStats cardsCount={counts.cards} stats={session.stats} retention={session.retention} rhythm={session.reviewRhythm} /></Disclosure>
      </section>}

      {activeView === "library" && <section id="review-view-panel-library" role="tabpanel" aria-labelledby="review-view-tab-library" className="space-y-5">
        <h2 className="text-lg font-semibold text-ink">{t("Your phrase library")}</h2>
        <SavedCardsBrowser cards={session.cards} />
        {onDiscover && <Button variant="secondary" onClick={onDiscover}>{t("Add content")}</Button>}
      </section>}
    </div>
  );
}
