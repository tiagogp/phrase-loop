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
import { startFirstRunActivation } from "@/features/activation/firstRun";
import { TabErrorBoundary } from "@/components/app/TabErrorBoundary";
import { LEVEL_RANK } from "@/features/discover/levels";
import { HojeHome } from "@/features/home/components/HojeHome";
import { LessonView } from "@/features/learn/components/LessonView";
import {
  firstLesson,
  lessonById,
  lessonProgressFromCardIds,
  nextLessonFor,
} from "@/features/learn/lessonDeck";
import { getLearningProfile } from "@/features/settings/learningProfile";
import OnboardingDialog from "@/features/settings/components/OnboardingDialog";
import type { ReviewView } from "@/features/study/components/ReviewWorkspaceNav";
import { PlanOnboarding } from "@/features/plan/components/PlanOnboarding";
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
  onTutorSettings,
  onOpenSettings,
  onOpenDiscover,
  onOpenPractice,
  onTransfer,
  onProgress,
  onTools,
  onTutor,
  studyView,
  reviewRequest,
  onStudyViewChange,
  onSpeak,
  onOpenCorrect,
  onFirstLesson,
  onOpenLesson,
  onOpenPlanTask,
  onCreatePlan,
  onInstallDefaultPlan,
  discoverPrefill,
  kokoro,
}: {
  tab: HomeTab;
  active: boolean;
  onTutorSettings: () => void;
  onOpenSettings: () => void;
  onOpenDiscover: () => void;
  onOpenPractice: () => void;
  onTransfer: () => void;
  onProgress: () => void;
  onTools: () => void;
  onTutor: () => void;
  studyView: ReviewView;
  reviewRequest: number;
  onStudyViewChange: (view: ReviewView) => void;
  /** Always defined: the method requires speaking to be reachable from day 1. */
  onSpeak: () => void;
  onOpenCorrect: () => void;
  onFirstLesson: () => void;
  onOpenLesson: (lessonId?: string) => void;
  onOpenPlanTask: (task: TaskItem) => void;
  onCreatePlan: () => void;
  onInstallDefaultPlan: () => void;
  discoverPrefill?: { url: string; nonce: number } | null;
  kokoro: LocalModelState;
}) {
  if (tab === "hoje") {
    return (
      <HojeHome
        onTutorSettings={onTutorSettings}
        onTutor={onTutor}
        onStudy={onOpenPractice}
        onTransfer={onTransfer}
        onProgress={onProgress}
        onTools={onTools}
        onDiscover={onOpenDiscover}
        onCorrect={onOpenCorrect}
        onFirstLesson={onFirstLesson}
        onLesson={onOpenLesson}
        onSpeak={onSpeak}
        onOpenPlanTask={onOpenPlanTask}
        onCreatePlan={onCreatePlan}
        onInstallDefaultPlan={onInstallDefaultPlan}
      />
    );
  }
  if (tab === "discover") {
    return (
      <DiscoverTab
        active={active}
        key={discoverPrefill?.nonce ?? "discover"}
        onOpenSettings={onOpenSettings}
        onStudyNow={onOpenPractice}
        onCorrect={onOpenCorrect}
        prefill={discoverPrefill}
      />
    );
  }
  if (tab === "progress") return <ProgressPage onPractice={onOpenPractice} onTutor={onTutor} />;
  if (tab === "study") return <StudyTab reviewRequest={reviewRequest} onOpenSettings={onOpenSettings} view={studyView} onViewChange={onStudyViewChange} onProgress={onProgress} onDiscover={onOpenDiscover} onConversation={onSpeak} onLesson={() => onOpenLesson()} onCorrect={onOpenCorrect} />;
  if (tab === "conversa") return <ConversationTab active={active} onOpenSettings={onOpenSettings} />;
  if (tab === "correct") return <CorrectTab onOpenSettings={onOpenSettings} onStudyNow={onOpenPractice} kokoroModel={kokoro} />;
  return null;
}

// Secondary workspaces stay reachable without changing the five primary destinations.
type Overlay = "settings" | "tools" | "correct" | "c1" | "tutor" | null;

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
  const [studyView, setStudyView] = useState<ReviewView>("review");
  const [reviewRequest, setReviewRequest] = useState(0);
  const [visitedTabs, setVisitedTabs] = useState<Set<HomeTab>>(() => new Set(["hoje"]));
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [lessonId, setLessonId] = useState<string | null>(null);
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
  const { tabs, tier, dueCount, announcement, clearAnnouncement } = useUnlockedTabs();
  const activeTab = tabs.some((item) => item.id === tab) ? tab : "hoje";
  const advancedSurfacesUnlocked = tier >= 3;
  useDockDueBadge();

  // Attempt records are the source of truth for support level. Refresh their
  // derived snapshot immediately after IndexedDB confirms a write, rather than
  // making progression depend on whether the learner visits Progress.
  useEffect(() => {
    if (!isStoreAvailable()) return;
    let queued = false;
    const refresh = () => {
      if (queued) return;
      queued = true;
      void refreshMethodProgression()
        .catch(() => undefined)
        .finally(() => {
          queued = false;
        });
    };
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
    setOverlay(null);
    const requestId = lessonRequestRef.current + 1;
    lessonRequestRef.current = requestId;
    void recommendedLessonId().then((resolvedLessonId) => {
      if (lessonRequestRef.current !== requestId) return;
      startFirstRunActivation({ source: "bundled_lesson", sourceId: resolvedLessonId });
      void emitActivity("first_run_started", { source: "bundled_lesson", sourceId: resolvedLessonId });
      setLessonId(resolvedLessonId);
    });
  };

  const openLesson = useCallback((nextLessonId?: string) => {
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
    if (task.type === "study" || task.type === "readWrite") return openPractice();
    if (task.type === "correct") return openCorrect();
    if (task.type === "converse") return openSpeaking();
    return openLesson(task.lessonId);
  }, [changeTab, openCorrect, openLesson, openPractice, openSpeaking]);

  const installStarterPlan = useCallback(() => {
    void installDefaultPlan(getLearningProfile()).catch(() => undefined);
  }, []);

  const announcedLabel = announcement
    ? tabs.find((item) => item.id === announcement)?.label ?? announcement
    : null;

  return (
        <div className="h-dvh overflow-hidden flex flex-col bg-surface">
          <AppHeader
            activeTab={activeTab}
            onTabChange={changeTab}
            settingsOpen={overlay === "settings"}
            onSettingsOpen={() => openSettings()}
            onToolsOpen={() => { setLessonId(null); setOverlay("tools"); }}
            tabs={tabs}
            badges={{ study: dueCount }}
          />

          {/* The model installs start on their own — voice right after onboarding,
              speech recognition on first use — so this bar lives above <main> and
              outside the tab switch: whichever tab or overlay the learner is on,
              they can see a download is still running and, if it failed, retry
              from where they already are. */}
          <ModelDownloadBar />

          <main className="flex-1 min-h-0" id="main-content">
            {lessonId !== null ? (
              <section className="h-full overflow-y-auto app-scroll-region">
                <m.div
                  className="max-w-5xl mx-auto px-4 pt-5 pb-14 sm:pt-7 sm:pb-20"
                  initial={false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={springSoft}
                >
                  <LessonView
                    lessonId={lessonId}
                    onBack={() => setLessonId(null)}
                    onStudyNow={openPractice}
                  />
                </m.div>
              </section>
            ) : overlay === "settings" ? (
              <div className="h-full overflow-y-auto pb-16 app-scroll-region sm:pb-20">
                <SettingsScreen
                  onBack={closeSettings}
                  onOpenTools={() => setOverlay("tools")}
                  onOpenC1={advancedSurfacesUnlocked ? () => setOverlay("c1") : undefined}
                  showAdvancedAi={true}
                />
              </div>
            ) : overlay === "tutor" ? (
              <div className="h-full overflow-y-auto app-scroll-region">
                <div className="mx-auto max-w-3xl px-4 py-6 pb-20">
                  <TabErrorBoundary><TutorWorkspace
                    onBack={() => setOverlay(null)}
                    onSettings={() => openSettings()}
                    onPractice={openPractice}
                    onConversation={openSpeaking}
                    onContent={() => changeTab("discover")}
                    onTools={() => setOverlay("tools")}
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
                    backLabel={t("Back to Settings")}
                    onBack={() => setOverlay("settings")}
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
                    title={t("Kokoro & Anki")}
                    description={t("Export to Anki, text-to-speech, and theme phrase lists.")}
                    backLabel={t("Back")}
                    onBack={() => setOverlay(null)}
                  />
                  <SpeechTab kokoroModel={kokoro} />
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
                    aria-labelledby={`tab-${item.id}`}
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
                        {item.id !== "hoje" && <div className="mb-4 flex justify-end"><Button variant="ghost" size="sm" onClick={() => setOverlay("tutor")}>Praticar com meu tutor →</Button></div>}
                        <TabContent
                          tab={item.id}
                          active={active && overlay === null && lessonId === null}
                          onTutorSettings={() => openSettings("tutor")}
                          onOpenSettings={() => openSettings()}
                          onOpenDiscover={() => changeTab("discover")}
                          onOpenPractice={openPractice}
                          onTransfer={openTransfer}
                          onProgress={() => changeTab("progress")}
                          onTools={() => setOverlay("tools")}
                          onTutor={() => setOverlay("tutor")}
                          studyView={studyView}
                          reviewRequest={reviewRequest}
                          onStudyViewChange={setStudyView}
                          onSpeak={openSpeaking}
                          onOpenCorrect={openCorrect}
                          onFirstLesson={startFirstLesson}
                          onOpenLesson={openLesson}
                          onOpenPlanTask={openPlanTask}
                          onCreatePlan={() => setPlanDialogOpen(true)}
                          onInstallDefaultPlan={installStarterPlan}
                          discoverPrefill={discoverPrefill}
                          kokoro={kokoro}
                        />
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
            <PlanGenerationToast onViewPlan={() => changeTab("hoje")} />
          </div>
          <OnboardingDialog
            onOpenSettings={() => openSettings()}
          />
          <PlanOnboarding
            open={planDialogOpen}
            onClose={() => setPlanDialogOpen(false)}
            onOpenSettings={() => {
              setPlanDialogOpen(false);
              openSettings();
            }}
          />
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
