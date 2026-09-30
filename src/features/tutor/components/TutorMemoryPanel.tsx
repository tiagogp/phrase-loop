"use client";

import { localizeTutorObservationDetail } from "../localization";
import { useTutorTranslation } from "../useTutorTranslation";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { saveTutorPreferences, type TutorMemory } from "../store";
import type { TutorPreferences } from "../types";

export const tutorInputClass = "w-full rounded-md border border-line bg-input px-3 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-60";

export function TutorMemoryPanel({ memory }: { memory: TutorMemory }) {
  const { t, lang, localize } = useTutorTranslation();
  const [goal, setGoal] = useState(memory.preferences.goal);
  const [language, setLanguage] = useState(memory.preferences.explanationLanguage);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function save(value: TutorPreferences) {
    setSaving(true); setMessage(null);
    try { await saveTutorPreferences(value); setMessage(t("Memory updated.")); }
    catch (e) { setMessage(e instanceof Error ? e.message : t("Could not save.")); }
    finally { setSaving(false); }
  }
  return <section aria-label={t("What my tutor remembers")} className="space-y-4 rounded-lg border border-line bg-card p-5">
    <h2 className="font-semibold text-ink">{t("What my tutor remembers")}</h2>
    <p className="text-sm text-ink-soft">{t("Your history stays in this browser. When you request a task, the tutor receives your goal and up to six relevant records. You can exclude records from this context without deleting your history.")}</p>
    <label className="block space-y-2 text-sm text-ink-soft"><span>{t("What I want to be able to do in English")}</span>
      <input className={tutorInputClass} maxLength={500} value={goal} onChange={e => setGoal(e.target.value)} placeholder={t("For example: take part in my team's meetings")} /></label>
    <label className="block space-y-2 text-sm text-ink-soft"><span>{t("Explanation language for future sessions")}</span>
      <select className={tutorInputClass} value={language} onChange={e => setLanguage(e.target.value as "pt" | "en")}><option value="pt">{t("Portuguese")}</option><option value="en">English</option></select></label>
    <Button variant="secondary" disabled={saving} onClick={() => void save({ ...memory.preferences, goal: goal.trim(), explanationLanguage: language })}>{t("Save preferences")}</Button>
    {message && <p role="status" className="text-sm text-ink-soft">{localize(message)}</p>}
    <h3 className="border-t border-line pt-4 text-sm font-medium text-ink">{t("Recent observations and their sources")}</h3>
    {!memory.observations.length && <p className="text-sm text-ink-muted">{t("No answers recorded yet. The tutor starts with the goal and level you provided.")}</p>}
    <ul className="max-h-96 space-y-3 overflow-y-auto">
      {memory.observations.slice(0, 12).map(observation => {
        const ignored = memory.preferences.ignoredEvidenceIds.includes(observation.id);
        return <li key={observation.id} className="rounded border border-line p-3 text-sm">
          <p className="font-medium text-ink">{localize(observation.label)} · {new Date(observation.createdAt).toLocaleDateString(lang === "pt" ? "pt-BR" : "en-US")}</p>
          <p className="mt-1 whitespace-pre-wrap text-ink-soft" lang="en">{observation.text}</p>
          <p className="mt-2 text-xs text-ink-muted">{localizeTutorObservationDetail(observation.detail, observation.kind, lang)} · {observation.supported === null ? t("Support not recorded") : observation.supported ? t("With support") : t("No support recorded")}</p>
          <Button variant="ghost" size="sm" disabled={saving} onClick={() => void save({ ...memory.preferences, ignoredEvidenceIds: ignored ? memory.preferences.ignoredEvidenceIds.filter(id => id !== observation.id) : [...memory.preferences.ignoredEvidenceIds, observation.id] })}>{ignored ? t("Allow the tutor to use this again") : t("Do not use in tutoring")}</Button>
        </li>;
      })}
    </ul>
    <Notice>{t("AI results assess specific tasks. They do not prove mastery of a level or assess your pronunciation.")}</Notice>
    {memory.preferences.ignoredEvidenceIds.length > 0 && <Button variant="ghost" disabled={saving} onClick={() => void save({ ...memory.preferences, ignoredEvidenceIds: [] })}>{t("Allow all records again ({count})", { count: memory.preferences.ignoredEvidenceIds.length })}</Button>}
  </section>;
}
