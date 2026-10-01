"use client";

import { useTutorTranslation } from "../useTutorTranslation";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { tutorSkillEvidence, tutorSkillKey, tutorSkillLabel, tutorSkillStates, uniqueTutorSkills } from "../learning";
import { recordTutorExposure } from "../store";
import { useTutorMemory } from "../useTutorMemory";

export function TutorProgressCard({ onOpen }: { onOpen: () => void }) {
  const { t, lang, localize } = useTutorTranslation();
  const { memory, error, refresh } = useTutorMemory();
  const [revealed, setRevealed] = useState(false);
  const [opening, setOpening] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  if (error) return <Card className="p-5"><p className="text-sm text-ink-soft">{t("Could not load your tutor sessions.")}</p><Button variant="ghost" onClick={() => void refresh()}>{t("Try again")}</Button></Card>;
  if (!memory) return <p role="status" className="text-sm text-ink-muted">{t("Loading progress…")}</p>;
  const skills = uniqueTutorSkills(memory?.sessions ?? []).map(skill => ({ skill, evidence: tutorSkillEvidence(memory!.sessions, skill, memory!.preferences) })).filter(item => item.evidence.attempts > 0);
  async function reveal() {
    setOpening(true); setReadError(null);
    try { await recordTutorExposure(memory?.sessions.map(s => s.id) ?? [], "history"); setRevealed(true); }
    catch { setReadError(t("Could not open the answers. Try again.")); }
    finally { setOpening(false); }
  }
  return <Card className="space-y-4 p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold text-ink">{t("Your progress with the tutor")}</h2><Button variant="ghost" size="sm" onClick={onOpen}>{t("Continue practice →")}</Button></div>
    <p className="text-sm text-ink-soft">{skills.length ? t("Skills tracked in this browser: {count}.", { count: skills.length }) : t("Your first practice starts your history. Getting it right after a hint counts as supported practice.")}</p>
    {skills.length > 0 && <>
    <div className="grid gap-3 text-sm sm:grid-cols-3">
      {[ [t("Successful answers with support"), "assisted"], [t("Successful answers without recent help"), "independent"], [t("Uses in a new context"), "transfers"] ].map(([label, key]) => <div key={key} className="rounded border border-line p-3"><p className="text-xl font-semibold text-ink">{skills.reduce((sum, s) => sum + s.evidence[key as "assisted" | "independent" | "transfers"], 0)}</p><p className="text-xs text-ink-muted">{label}</p></div>)}
    </div>
    <p className="text-xs text-ink-muted">{t("These answers used the skill in a different authored situation after an earlier difficulty, with at least 24 hours since recorded help. Assessments you disputed or excluded do not count.")}</p>
    </>}
    {readError && <p role="alert" className="text-sm text-ink-soft">{readError}</p>}
    {!revealed && skills.length > 0 && <Button variant="secondary" disabled={opening} onClick={() => void reveal()}>{opening ? t("Opening…") : t("View skills and compare answers")}</Button>}
    {!revealed && skills.length > 0 && <p className="text-xs text-ink-muted">{t("Viewing the answers counts as support for the next revisit.")}</p>}
    {revealed && skills.map(({ skill, evidence }) => <section key={tutorSkillKey(skill)} className="space-y-3 rounded-lg border border-line p-4">
      <h3 className="font-medium text-ink">{localize(tutorSkillLabel(skill))}</h3>
      <p className="text-sm text-accent">{localize(tutorSkillStates[evidence.state])}</p>
      <p className="text-sm text-ink-soft">{t("Sessions improved after feedback:")} {evidence.improvements} {t("· Difficulties in the last")} {Math.min(5, evidence.attempts)} {t("valid answers:")} {evidence.recentFailures} {t("· Verified new contexts:")} {evidence.contexts}.</p>
      <div className="grid gap-3 sm:grid-cols-2">{[{ label: t("Observed difficulty"), row: evidence.before }, { label: t("Use in a new situation without recent help"), row: evidence.after }].map(({ label, row }) => <div key={label} className="space-y-2 rounded border border-line p-3"><p className="text-xs font-medium text-accent">{label}</p>{row ? <><p className="text-xs text-ink-muted">{new Date(row.attempt.createdAt).toLocaleDateString(lang === "pt" ? "pt-BR" : "en-US")} · {localize(row.session.task.situation)}</p><blockquote className="text-sm text-ink" lang="en">{row.attempt.text}</blockquote><p className="text-xs text-ink-muted">{row.attempt.supportUsed ? t("With recorded support") : t("Without asking for support in the answer")} {t("· AI assessment")}</p></> : <p className="text-xs text-ink-muted">{t("Not observed yet.")}</p>}</div>)}</div>
      <p className="text-xs text-ink-muted">{t("These are different situations; this comparison shows evidence of use without estimating a percentage gain or definitive mastery.")}</p>
    </section>)}
  </Card>;
}
