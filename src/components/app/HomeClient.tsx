"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { m } from "motion/react";
import dynamic from "next/dynamic";
import { BLUR, springSoft, TRAVEL } from "@/lib/motion";
import AppHeader from "@/components/app/AppHeader";
import { type HomeTab } from "@/components/app/homeTabs";
import AppProviders from "@/components/app/AppProviders";
import { useUnlockedTabs } from "@/components/app/useUnlockedTabs";
import { useDockDueBadge } from "@/components/app/useDockDueBadge";
import { useAiSettings } from "@/features/settings/context/AiSettingsContext";
import { useExperiencePreferences, setFullNavigation } from "@/features/activation/experiencePreferences";
import { startFirstRunActivation } from "@/features/activation/firstRun";
import { TabErrorBoundary } from "@/components/app/TabErrorBoundary";
import { LEVEL_RANK } from "@/features/discover/levels";
import { QuickLesson } from "@/features/learn/components/QuickLesson";
import { nextQuickPhraseIndex } from "@/features/learn/quickPractice";
import { ExploreHome, type ExploreActions } from "@/features/home/components/ExploreHome";
import { TodayPlanCard } from "@/features/plan/components/TodayPlanCard";
import { HojeHome } from "@/features/home/components/HojeHome";
import {
  firstLesson,
  lessonById,
  lessonProgressFromCardIds,
  nextLessonFor,
} from "@/features/learn/lessonDeck";
import { getLearningProfile } from "@/features/settings/learningProfile";
import OnboardingDialog from "@/features/settings/components/OnboardingDialog";
import type { ReviewView } from "@/features/study/components/ReviewWorkspaceNav";
import { PlanGenerationToast } from "@/features/plan/components/PlanGenerationToast";
import { installDefaultPlan } from "@/features/plan/defaultPlans";
import type { TaskItem } from "@/features/plan/schema";
import ModelDownloadBar from "@/features/speech/components/ModelDownloadBar";
import { useKokoroModel, type LocalModelState } from "@/features/speech/hooks/useLocalModel";
import { useT } from "@/i18n/I18nProvider";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { isStoreAvailable } from "@/lib/store/db";
import { emitActivity } from "@/lib/store/activityLog";
import { getCards } from "@/lib/store/repository";
import { refreshMethodProgression } from "@/features/method/progressionPersistence";
import { WorkspaceActivityContext } from "@/lib/workspaceActivity";

function WorkspaceLoading() {
  const { t } = useT();
  return <div role="status" className="min-h-48 rounded-lg border border-line bg-card p-6 text-sm text-ink-muted">{t("Loading…")}</div>;
}

const C1Tab = dynamic(() => import("@/features/c1/components/C1Tab"), { loading: WorkspaceLoading });
const ConversationTab = dynamic(() => import("@/features/converse/components/ConversationTab"), { loading: WorkspaceLoading });
const CorrectTab = dynamic(() => import("@/features/correct/components/CorrectTab"), { loading: WorkspaceLoading });
const DiscoverTab = dynamic(() => import("@/features/discover/components/DiscoverTab"), { loading: WorkspaceLoading });
const SettingsScreen = dynamic(() => import("@/features/settings/components/SettingsScreen"), { loading: WorkspaceLoading });
const SpeechTab = dynamic(() => import("@/features/speech/components/SpeechTab"), { loading: WorkspaceLoading });
const StudyTab = dynamic(() => import("@/features/study/components/StudyTab"), { loading: WorkspaceLoading });
const ProgressPage = dynamic(() => import("@/features/progress/components/ProgressPage"), { loading: WorkspaceLoading });
const TutorWorkspace = dynamic(() => import("@/features/tutor/components/TutorWorkspace"), { loading: WorkspaceLoading });

const LessonView = dynamic(() => import("@/features/learn/components/LessonView").then(module => module.LessonView), { loading: WorkspaceLoading });
const PlanOnboarding = dynamic(() => import("@/features/plan/components/PlanOnboarding").then(module => module.PlanOnboarding), { loading: WorkspaceLoading });

async function recommendedLessonId(): Promise<string> {
  const profile = getLearningProfile();
  const noProgress = lessonProgressFromCardIds([]);
  if (!isStoreAvailable()) return nextLessonFor(profile, noProgress)?.id ?? firstLesson().id;
  try {
    const cards = await getCards();
    const progress = lessonProgressFromCardIds(cards.map((card) => card.id));
    return nextLessonFor(profile, progress)?.id ?? firstLesson().id;
  } catch {
    return nextLessonFor(profile, noProgress)?.id ?? firstLesson().id;
  }
}

async function resolveLessonId(nextLessonId?: string): Promise<string> {
  const profile = getLearningProfile();
  const requested = nextLessonId ? lessonById(nextLessonId) : undefined;
  if (requested && LEVEL_RANK[requested.level] >= LEVEL_RANK[profile.level]) return requested.id;
  return recommendedLessonId();
}

function TabContent({
  tab,
  active,
  onOpenSettings,
  onOpenDiscover,
  onOpenPractice,
  onTransfer,
  onProgress,
  onTutor,
  onExtra,
  onContentPractice,
  studyView,
  reviewRequest,
  onStudyViewChange,
  onSpeak,
  onOpenCorrect,
  onFirstLesson,
  onOpenPlanTask,
  discoverPrefill,
  kokoro,
  exploreActions,
  onExplore,
  onPlan,
  onHome,
}: {
  exploreActions: ExploreActions;
  onExplore: () => void;
  onPlan: () => void;
  onHome: () => void;
  tab: HomeTab;
  active: boolean;
  onOpenSettings: () => void;
  onOpenDiscover: () => void;
  onOpenPractice: () => void;
  onTransfer: () => void;
  onProgress: () => void;
  onTutor: () => void;
  onExtra: () => void;
  onContentPractice: (cardId: string) => void;
  studyView: ReviewView;
  reviewRequest: number;
  onStudyViewChange: (view: ReviewView) => void;
  /** Always defined: the method requires speaking to be reachable from day 1. */
  onSpeak: () => void;
  onOpenCorrect: () => void;
  onFirstLesson: () => void;
  onOpenPlanTask: (task: TaskItem) => void;
  discoverPrefill?: { url: string; nonce: number } | null;
  kokoro: LocalModelState;
}) {
  if (tab === "hoje") {
    return (
      <HojeHome onTutor={onTutor} onExtra={onExtra} onStudy={onOpenPractice} onTransfer={onTransfer}
        onProgress={onProgress} onDiscover={onOpenDiscover} onFirstLesson={onFirstLesson}
        onSpeak={onSpeak} onOpenPlanTask={onOpenPlanTask} onExplore={onExplore} onPlan={onPlan}
      />
    );
  }
  if (tab === "explore") return <ExploreHome {...exploreActions} />;
  if (tab === "discover") {
    return (
      <DiscoverTab
        active={active}
        key={discoverPrefill?.nonce ?? "discover"}
        onOpenSettings={onOpenSettings}
        onStudyNow={onOpenPractice}
        onCorrect={onOpenCorrect}
        prefill={discoverPrefill}
        onPracticeSource={onContentPractice}
      />
    );
  }
  if (tab === "progress") return <ProgressPage active={active} onPractice={onOpenPractice} onTutor={onTutor} />;
  if (tab === "study") return <StudyTab active={active} onHome={onHome} onTools={() => exploreActions.onTools("anki")} reviewRequest={reviewRequest} onOpenSettings={onOpenSettings} view={studyView} onViewChange={onStudyViewChange} onProgress={onProgress} onDiscover={onOpenDiscover} onConversation={onSpeak} onLesson={onFirstLesson} onCorrect={onOpenCorrect} />;
  if (tab === "conversa") return <ConversationTab active={active} onOpenSettings={onOpenSettings} />;
  if (tab === "correct") return <CorrectTab onOpenSettings={onOpenSettings} onStudyNow={onOpenPractice} kokoroModel={kokoro} />;
  return null;
}

// Secondary workspaces stay reachable without changing the five primary destinations.
type Overlay = "settings" | "tools" | "correct" | "c1" | "tutor" | "plan" | null;

function OverlayHeader({
  title,
  description,
  backLabel,
  onBack,
}: {
  title: string;
  description?: string;
  backLabel: string;
  onBack: () => void;
}) {
  return (
    <div className="mb-6 space-y-4 border-b border-line pb-5">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 min-h-9">
        <span aria-hidden="true">←</span>
        {backLabel}
      </Button>
      <PageHeader title={title} description={description} />
    </div>
  );
}

function HomeContent() {
  const { t } = useT();
  const [tab, setTab] = useState<HomeTab>("hoje");
  const [studyView, setStudyView] = useState<ReviewView>("library");
  const [reviewRequest, setReviewRequest] = useState(0);
  const [visitedTabs, setVisitedTabs] = useState<Set<HomeTab>>(() => new Set(["hoje"]));
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [tutorRequest, setTutorRequest] = useState<{ intent: "recommended" | "new" | "extra"; sourceCardId?: string; nonce: number }>({ intent: "recommended", nonce: 0 });
  const [quickLesson, setQuickLesson] = useState(false);
  const [quickPhraseIndex, setQuickPhraseIndex] = useState(0);
  const [tool, setTool] = useState("anki");
  const [lessonId, setLessonId] = useState<string | null>(null);
  function openTutor(intent: "recommended" | "new" | "extra", sourceCardId?: string) {
    setTutorRequest(previous => ({ intent, sourceCardId, nonce: previous.nonce + 1 }));
    setLessonId(null); setOverlay("tutor");
  }
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [discoverPrefill] = useState<{ url: string; nonce: number } | null>(null);
  const lessonRequestRef = useRef(0);
  const settingsReturn = useRef<{ overlay: Exclude<Overlay, "settings">; lessonId: string | null }>({ overlay: null, lessonId: null });
  const openSettings = useCallback((origin?: Exclude<Overlay, "settings">) => {
    if (overlay !== "settings") {
      settingsReturn.current = { overlay: origin === undefined ? overlay : origin, lessonId: origin === undefined ? lessonId : null };
    }
    lessonRequestRef.current += 1;
    setLessonId(null);
    setOverlay("settings");
  }, [overlay, lessonId]);
  const closeSettings = useCallback(() => {
    setOverlay(settingsReturn.current.overlay);
    setLessonId(settingsReturn.current.lessonId);
  }, []);
  const kokoro = useKokoroModel();
  const { tabs, dueCount, announcement, clearAnnouncement } = useUnlockedTabs();
  const activeTab = tabs.some((item) => item.id === tab) ? tab : "hoje";
  const { fullNavigation } = useExperiencePreferences();
  const { settings } = useAiSettings();
  useDockDueBadge();

  // Attempt records are the source of truth for support level. Refresh their
  // derived snapshot immediately after IndexedDB confirms a write, rather than
  // making progression depend on whether the learner visits Progress.
  useEffect(() => {
    if (!isStoreAvailable()) return;
    const refresh = () => { void refreshMethodProgression().catch(() => undefined); };
    refresh();
    window.addEventListener("phraseloop:performance-evidence", refresh);
    return () => window.removeEventListener("phraseloop:performance-evidence", refresh);
  }, []);

  useEffect(() => {
    if (!announcement) return;
    const timer = window.setTimeout(clearAnnouncement, 3600);
    return () => window.clearTimeout(timer);
  }, [announcement, clearAnnouncement]);

  const changeTab = useCallback((next: HomeTab) => {
    lessonRequestRef.current += 1;
    setVisitedTabs((previous) => new Set([...previous, next]));
    setTab(tabs.some((item) => item.id === next) ? next : "hoje");
    setOverlay(null);
    setLessonId(null);
  }, [tabs]);

  const openSpeaking = useCallback(() => changeTab("conversa"), [changeTab]);
  const openPractice = useCallback(() => {
    setReviewRequest((request) => request + 1);
    setStudyView("review");
    changeTab("study");
  }, [changeTab]);
  const openTransfer = useCallback(() => {
    setStudyView("use");
    changeTab("study");
  }, [changeTab]);
  const openCorrect = useCallback(() => {
    lessonRequestRef.current += 1;
    setLessonId(null);
    setOverlay("correct");
  }, []);

  // "Hoje" -> Start: open the learner's recommended bundled lesson through the
  // same save -> review path used after custom discovery.
  const startFirstLesson = () => {
    setQuickLesson(true);
    setOverlay(null);
    const requestId = lessonRequestRef.current + 1;
    lessonRequestRef.current = requestId;
    void recommendedLessonId().then(async (resolvedLessonId) => {
      const cards = await getCards().catch(() => []);
      if (lessonRequestRef.current !== requestId) return;
      setQuickPhraseIndex(nextQuickPhraseIndex(lessonById(resolvedLessonId) ?? firstLesson(), cards.map(card => card.id)));
      startFirstRunActivation({ source: "bundled_lesson", sourceId: resolvedLessonId });
      void emitActivity("first_run_started", { source: "bundled_lesson", sourceId: resolvedLessonId });
      setLessonId(resolvedLessonId);
    });
  };

  const openLesson = useCallback((nextLessonId?: string) => {
    setQuickLesson(false);
    const requestId = lessonRequestRef.current + 1;
    lessonRequestRef.current = requestId;
    setOverlay(null);
    setTab("hoje");
    void resolveLessonId(nextLessonId).then((resolvedLessonId) => {
      if (lessonRequestRef.current === requestId) setLessonId(resolvedLessonId);
    });
  }, []);

  const openPlanTask = useCallback((task: TaskItem) => {
    if (task.type === "discover") return changeTab("discover");
    if (task.type === "study") return openPractice();
    if (task.type === "readWrite") return openTransfer();
    if (task.type === "correct") return openCorrect();
    if (task.type === "converse") return openSpeaking();
    return openLesson(task.lessonId);
  }, [changeTab, openCorrect, openLesson, openPractice, openSpeaking, openTransfer]);

  const installStarterPlan = useCallback(() => {
    void installDefaultPlan(getLearningProfile()).catch(() => undefined);
  }, []);

  const announcedLabel = announcement
    ? tabs.find((item) => item.id === announcement)?.label ?? announcement
    : null;

  return (
        <div className="h-dvh overflow-hidden flex flex-col bg-surface">
          <a href="#main-content" className="sr-only z-[120] rounded-md bg-card px-4 py-3 text-ink shadow-lg focus:not-sr-only focus:fixed focus:left-4 focus:top-4">{t("Skip to content")}</a>
          <AppHeader
            activeTab={activeTab}
            onTabChange={next => { if (next === "study") setStudyView("library"); changeTab(next); }}
            settingsOpen={overlay === "settings"}
            onSettingsOpen={() => openSettings()}
            tabs={tabs}
            focusedNavigation={!fullNavigation}
            onShowAll={() => setFullNavigation(true)}
            badges={{ study: dueCount }}
          />

          {/* The model installs start on their own — voice right after onboarding,
              speech recognition on first use — so this bar lives above <main> and
              outside the tab switch: whichever tab or overlay the learner is on,
              they can see a download is still running and, if it failed, retry
              from where they already are. */}
          <ModelDownloadBar />

          <main className="flex-1 min-h-0" id="main-content" tabIndex={-1}>
            {lessonId !== null ? (
              <section className="h-full overflow-y-auto app-scroll-region">
                <m.div
                  className="max-w-5xl mx-auto px-4 pt-5 pb-14 sm:pt-7 sm:pb-20"
                  initial={false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={springSoft}
                >
                  {quickLesson ? <QuickLesson key={`${lessonId}-${quickPhraseIndex}`} lessonId={lessonId} phraseIndex={quickPhraseIndex} onBack={() => changeTab("hoje")} onFullLesson={() => setQuickLesson(false)} /> : <LessonView
                    lessonId={lessonId}
                    onBack={() => setLessonId(null)}
                    onStudyNow={openPractice}
                  />}
                </m.div>
              </section>
            ) : overlay === "plan" ? (
              <div className="h-full overflow-y-auto app-scroll-region"><div className="mx-auto max-w-3xl px-4 py-6">
                <OverlayHeader title={t("My goal and plan")} description={t("Today selects your next activity. This is the longer view.")} backLabel={t("Back")} onBack={() => setOverlay(null)} />
                <TodayPlanCard onOpenTask={openPlanTask} onCreatePlan={() => setPlanDialogOpen(true)} onInstallDefault={installStarterPlan} />
              </div></div>
            ) : overlay === "settings" ? (
              <div className="h-full overflow-y-auto pb-16 app-scroll-region sm:pb-20">
                <SettingsScreen
                  onBack={closeSettings}
                  onOpenTools={() => setOverlay("tools")}
                  onOpenC1={() => setOverlay("c1")}
                  showAdvancedAi={true}
                />
              </div>
            ) : overlay === "tutor" ? (
              <div className="h-full overflow-y-auto app-scroll-region">
                <div className="mx-auto max-w-3xl px-4 py-6 pb-20">
                  <TabErrorBoundary><TutorWorkspace key={tutorRequest.nonce} intent={tutorRequest.intent} sourceCardId={tutorRequest.sourceCardId}
                    onBack={() => changeTab("hoje")}
                    onSettings={() => openSettings()}
                    onPractice={openPractice}
                    onConversation={openSpeaking}
                    onContent={() => changeTab("discover")}
                    onTools={() => setOverlay("tools")}
                    onLocalPractice={startFirstLesson}
                  /></TabErrorBoundary>
                </div>
              </div>
            ) : overlay === "correct" ? (
              <div className="h-full overflow-y-auto app-scroll-region">
                <div className="mx-auto max-w-5xl px-4 py-6">
                  <Button variant="ghost" onClick={() => setOverlay(null)}>{t("Back")}</Button>
                  <CorrectTab onOpenSettings={() => openSettings()} onStudyNow={openPractice} kokoroModel={kokoro} />
                </div>
              </div>
            ) : overlay === "c1" ? (
              <div className="h-full overflow-y-auto pb-16 app-scroll-region sm:pb-20">
                <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
                  <OverlayHeader
                    title={t("C1 diagnosis")}
                    description={t("Review register, naturalness, and collocation at an advanced level.")}
                    backLabel={t("Back")}
                    onBack={() => setOverlay(null)}
                  />
                  <C1Tab
                    onOpenSettings={() => openSettings()}
                  />
                </div>
              </div>
            ) : overlay === "tools" ? (
              <div className="h-full overflow-y-auto pb-16 app-scroll-region sm:pb-20">
                <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
                  <OverlayHeader
                    title={t("Audio and export")}
                    description={t("Export to Anki, text-to-speech, and theme phrase lists.")}
                    backLabel={t("Back")}
                    onBack={() => setOverlay(null)}
                  />
                  <SpeechTab key={tool} kokoroModel={kokoro} initialTool={tool} />
                </div>
              </div>
            ) : null}
            <div hidden={lessonId !== null || overlay !== null} className="h-full">
              {tabs.map((item) => {
                const active = activeTab === item.id;
                return (
                  <section
                    key={item.id}
                    id={`panel-${item.id}`}
                    hidden={!active}
                    aria-label={t(item.label)}
                    role="tabpanel"
                    tabIndex={0}
                    className="h-full overflow-y-auto app-scroll-region"
                  >
                    {/* Mount stays alive across tab switches so each tab keeps its
                        state; only the entrance animation replays on activation. */}
                    {visitedTabs.has(item.id) && <m.div
                      className="max-w-5xl mx-auto px-4 pt-5 pb-14 sm:pt-7 sm:pb-20"
                      initial={false}
                      animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: TRAVEL }}
                      transition={springSoft}
                    >
                      <TabErrorBoundary>
                        <WorkspaceActivityContext value={active && overlay === null && lessonId === null}>
                          <TabContent
                            tab={item.id}
                            active={active && overlay === null && lessonId === null}
                            onOpenSettings={() => openSettings()}
                            onOpenDiscover={() => changeTab("discover")}
                            onOpenPractice={openPractice}
                            onTransfer={openTransfer}
                            onProgress={() => changeTab("progress")}
                            onTutor={() => openTutor("recommended")}
                            onExtra={() => openTutor("extra")}
                            onContentPractice={cardId => openTutor("new", cardId)}
                            studyView={studyView}
                            reviewRequest={reviewRequest}
                            onStudyViewChange={setStudyView}
                            onSpeak={openSpeaking}
                            onOpenCorrect={openCorrect}
                            onFirstLesson={startFirstLesson}
                            onOpenPlanTask={openPlanTask}
                            discoverPrefill={discoverPrefill}
                            kokoro={kokoro}
                            onExplore={() => changeTab("explore")}
                            onPlan={() => setOverlay("plan")}
                            onHome={() => changeTab("hoje")}
                            exploreActions={{
                              onTutor: () => openTutor("new"), onLesson: () => openLesson(), onSpeak: openSpeaking,
                              onCorrect: openCorrect, onDiscover: () => changeTab("discover"), onReview: openPractice,
                              onFocus: () => { setStudyView("progress"); changeTab("study"); },
                              onProgress: () => changeTab("progress"), onPlan: () => setOverlay("plan"),
                              onC1: () => setOverlay("c1"), onTools: selected => { setTool(selected); setOverlay("tools"); },
                            }}
                          />
                        </WorkspaceActivityContext>
                      </TabErrorBoundary>
                    </m.div>}
                  </section>
                );
              })}
            </div>
          </main>
          {/* One bottom-center stack, so a plan finishing while a section unlocks
              does not put two toasts on top of each other. */}
          <div className="pointer-events-none fixed bottom-5 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-2">
            {announcedLabel && (
              <m.div
                className="rounded-md border border-line bg-card px-3 py-2 text-sm font-medium text-ink shadow-lg"
                initial={{ opacity: 0, y: 10, filter: `blur(${BLUR}px)` }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: 10, filter: `blur(${BLUR}px)` }}
                transition={springSoft}
                role="status"
              >
                {t("New section unlocked: {section}", { section: t(announcedLabel) })}
              </m.div>
            )}
            <PlanGenerationToast onViewPlan={() => { setLessonId(null); setOverlay("plan"); }} />
          </div>
          <OnboardingDialog
            onStart={() => settings.providers.some(provider => provider.available) ? openTutor("recommended") : startFirstLesson()}
          />
          {planDialogOpen && <PlanOnboarding
            open={planDialogOpen}
            onClose={() => setPlanDialogOpen(false)}
            onOpenSettings={() => {
              setPlanDialogOpen(false);
              openSettings();
            }}
          />}
        </div>
  );
}

export default function HomeClient() {
  return (
    <AppProviders>
      <HomeContent />
    </AppProviders>
  );
}
