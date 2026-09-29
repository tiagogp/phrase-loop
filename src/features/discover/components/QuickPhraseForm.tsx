"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Textarea } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { useT } from "@/i18n/I18nProvider";
import { getCard, saveGeneratedDeck } from "@/lib/store/repository";
import { emitActivity } from "@/lib/store/activityLog";
import { buildManualPhrase } from "../manualPhrase";

export function QuickPhraseForm({ onStudy }: { onStudy?: () => void }) {
  const { t } = useT();
  const id = useId();
  const [english, setEnglish] = useState("");
  const [meaning, setMeaning] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const save = async () => {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setMessage(null);
    setFailed(false);
    try {
      const { cards, candidate } = await buildManualPhrase(english, meaning);
      if (await getCard(cards[0].id)) {
        setMessage("This phrase is already in your library. Its review schedule is unchanged.");
      } else {
        const { added } = await saveGeneratedDeck(cards, [candidate]);
        void emitActivity("cards_created", { count: added, source: "discover" }).catch(() => undefined);
        setMessage("Phrase saved in both directions. Try recalling it now, or export it with Kokoro & Anki.");
      }
    } catch {
      setFailed(true);
      setMessage("Could not save this phrase. Your text is still here; try again.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  const edit = () => { setMessage(null); setFailed(false); };
  return <Card className="space-y-4 p-5">
    <div><h2 className="text-lg font-semibold text-ink">{t("Keep one useful phrase")}</h2>
      <p className="mt-1 text-sm text-ink-muted">{t("Already know what you want to practice? Add the phrase and its meaning. No AI needed.")}</p></div>
    <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("English phrase")} htmlFor={`${id}-en`}>
          <Textarea id={`${id}-en`} lang="en" rows={3} maxLength={500} required value={english} disabled={busy}
            placeholder="I'd like to reschedule our meeting."
            onChange={(event) => { setEnglish(event.target.value); edit(); }} />
        </Field>
        <Field label={t("Meaning in Portuguese")} htmlFor={`${id}-pt`}>
          <Textarea id={`${id}-pt`} lang="pt" rows={3} maxLength={500} required value={meaning} disabled={busy}
            placeholder="Eu gostaria de remarcar nossa reunião."
            onChange={(event) => { setMeaning(event.target.value); edit(); }} />
        </Field>
      </div>
      <p className="text-xs text-ink-muted">{t("Use a phrase you checked in a reliable source. Manual entries are saved as you write them.")}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" disabled={busy || !english.trim() || !meaning.trim()}>{t(busy ? "Saving…" : "Save phrase")}</Button>
        {message && !failed && onStudy && <Button type="button" variant="secondary" onClick={onStudy}>{t("Practice now")}</Button>}
      </div>
      {message && <Notice role="status" tone={failed ? "error" : "success"}>{t(message)}</Notice>}
    </form>
  </Card>;
}
