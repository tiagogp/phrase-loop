"use client";

import Disclosure from "@/components/ui/Disclosure";

import { useState, useSyncExternalStore } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { ENGLISH_LEVELS } from "@/features/discover/constants";
import type { EnglishLevel } from "@/features/discover/types";
import { NATIVE_LANGUAGES } from "@/features/settings/languages";
import {
  completeOnboarding,
  OBJECTIVE_OPTIONS,
  getLearningProfile,
  isOnboardingComplete,
  type MethodObjective,
} from "@/features/settings/learningProfile";
import { useAiSettings } from "@/features/settings/context/AiSettingsContext";
import { useT } from "@/i18n/I18nProvider";
import { nextLevelOf } from "@/features/levelup/model";
import { LevelTestFlow } from "@/features/levelup/components/LevelTestFlow";
import { LocalPlacementCheck } from "@/features/levelup/components/LocalPlacementCheck";

const subscribe = () => () => {};


export default function OnboardingDialog({ onStart }: Readonly<{ onStart: () => void }>) {
  const { t } = useT();
  const [dismissed, setDismissed] = useState(false);
  const [levelCheckOpen, setLevelCheckOpen] = useState<"local" | "ai" | null>(null);
  const [profile] = useState(getLearningProfile);
  const [level, setLevel] = useState<EnglishLevel>(profile.createdAt ? profile.level : "A2");
  const [nativeLang, setNativeLang] = useState(profile.nativeLang);
  const [objective, setObjective] = useState<MethodObjective>(profile.createdAt ? profile.objective : "professional");
  const [dailyMinutes, setDailyMinutes] = useState(profile.dailyMinutes ?? 10);
  const { settings, loading } = useAiSettings();
  const hasAi = settings.providers.some(provider => provider.available);
  const defaultProvider = settings.providers.find((provider) => provider.kind === settings.defaultProvider);
  const levelCheckTarget = nextLevelOf(level);
  const firstVisit = useSyncExternalStore(
    subscribe,
    () => !isOnboardingComplete(),
    () => false,
  );
  const open = firstVisit && !dismissed;

  const languageOptions = NATIVE_LANGUAGES.map((l) => ({ value: l.code, label: t(l.label) }));

  const finish = (start: boolean) => {
    const focus = OBJECTIVE_OPTIONS.find((item) => item.objective === objective)?.label ?? "";
    completeOnboarding({
      track: "beginner",
      level,
      nativeLang,
      targetLang: "en",
      objective,
      focus,
      goal: profile.goal,
      dailyMinutes,
    });
    setDismissed(true);
    if (start) onStart();
  };


  if (levelCheckOpen === "local") {
    return (
      <Modal open={open} onClose={() => setLevelCheckOpen(null)} labelledBy="placement-title" className="w-[min(100%,34rem)]">
        <LocalPlacementCheck
          translate={t}
          onAccept={(suggested) => {
            setLevel(suggested);
            setLevelCheckOpen(null);
          }}
          onClose={() => setLevelCheckOpen(null)}
        />
      </Modal>
    );
  }

  if (levelCheckOpen === "ai" && levelCheckTarget) {
    return (
      <Modal open={open} onClose={() => setLevelCheckOpen(null)} labelledBy="level-test-title" className="w-[min(100%,34rem)]">
        <LevelTestFlow
          currentLevel={level}
          targetLevel={levelCheckTarget}
          focusGaps={[]}
          onClose={() => {
            // The test may have advanced the profile level (on a pass) — re-sync the
            // onboarding form so "Start first lesson" saves the level the test confirmed.
            setLevel(getLearningProfile().level);
            setLevelCheckOpen(null);
          }}
        />
      </Modal>
    );
  }

  return (
    <Modal open={open} closeOnBackdrop={false} labelledBy="welcome-title" className="w-[min(100%,34rem)]">
      <div>
        <p className="text-xs uppercase tracking-widest text-accent">{t("Welcome")}</p>
        <h2 id="welcome-title" className="mt-2 text-2xl font-semibold text-ink">{t("One situation. One answer of your own.")}</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">{t(hasAi ? "Try a short answer in English, understand one adjustment, and try again. Your next practice starts from what you did today." : "Start with one useful phrase. Try remembering it and keep it for another day. You can connect an AI later for personal feedback.")}</p>
        <p className="mt-3 text-xs text-ink-muted">{t("Start with {level} English. You can change your level and goal whenever you need.", { level })}</p>
      </div>
      <Disclosure title={t("Adjust my starting point")} className="mt-5" contentClassName="space-y-5" nested>
        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-accent">{t("Your level")}</p>
            <h3 className="mt-1 text-lg font-semibold text-ink">
              {t("Choose your English level first")}
            </h3>
            <p className="mt-2 text-sm text-ink-soft">
              {t("This helps PhraseLoop start with phrases that are useful without being too easy.")}
            </p>
          </div>
          <Field label={t("Level")}>
            <Select
              value={level}
              onChange={(value) => setLevel(value as EnglishLevel)}
              options={ENGLISH_LEVELS}
            />
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              {/* The local check needs no provider, so "not sure" is never a dead end. */}
              <button
                type="button"
                onClick={() => setLevelCheckOpen("local")}
                className="cursor-pointer text-xs font-medium text-accent hover:opacity-80"
              >
                {t("Not sure? Take a 5-minute check")}
              </button>
              {levelCheckTarget && defaultProvider?.available === true && (
                <button
                  type="button"
                  onClick={() => setLevelCheckOpen("ai")}
                  className="cursor-pointer text-xs font-medium text-ink-muted hover:opacity-80"
                >
                  {t("Or take the full {level} test with AI", { level: levelCheckTarget })}
                </button>
              )}
            </div>
          </Field>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-accent">{t("Your routine")}</p>
            <h3 className="mt-1 text-lg font-semibold text-ink">
              {t("Calibrate the first week")}
            </h3>
            <p className="mt-2 text-sm text-ink-soft">
              {t("Three choices are enough to start. You can tune the rest later.")}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("Your language")}>
              <Select
                value={nativeLang}
                onChange={setNativeLang}
                options={languageOptions}
              />
            </Field>
            <Field group label={t("Learning")}>
              <div className="rounded border border-line bg-surface px-3 py-2 text-sm text-ink-soft">
                {t("English")}
              </div>
            </Field>
          </div>
          <Field group label={t("Main goal")}>
            <Segmented
              label={t("Main goal")}
              value={objective}
              onChange={setObjective}
              variant="inline"
              className="flex w-full flex-wrap [&>button]:flex-1 [&>button]:basis-28"
              options={OBJECTIVE_OPTIONS.map((item) => ({
                value: item.objective,
                label: t(item.label),
              }))}
            />
          </Field>
          <Field group label={t("Time for today")} hint={t("A small review batch, then one answer of your own. Change it in Settings whenever you need.")}>
            <Segmented label={t("Time for today")} value={String(dailyMinutes)}
              onChange={(value) => setDailyMinutes(Number(value))}
              options={[5, 10, 20].map((value) => ({ value: String(value), label: t("{count} min", { count: value }) }))} />
          </Field>
        </div>
      </Disclosure>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        <Button variant="ghost" onClick={() => finish(false)}>{t("Explore on my own")}</Button>
        <Button variant="primary" disabled={loading} onClick={() => finish(true)}>{t("Start my first practice")} →</Button>
      </div>
    </Modal>
  );
}
