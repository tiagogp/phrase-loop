import type { UiLang } from "@/i18n/config";
import { translate } from "@/i18n/translate";
import { tutorMessages } from "@/i18n/tutorMessages";

const sourceByPortuguese = new Map(Object.entries(tutorMessages).map(([en, { pt }]) => [pt, en]));

/** Localize known authored text in existing records without changing their stored
 * task identity (used to verify transfer). Learner and generated text stays intact. */
export function localizeTutorText(text: string, lang: UiLang): string {
  return translate(lang, sourceByPortuguese.get(text) ?? text);
}

/** Observation details combine app-authored metadata with an unchanged historical
 * answer or assessment. Translate only the metadata boundaries. */
export function localizeTutorObservationDetail(detail: string, kind: string, lang: UiLang): string {
  if (kind === "tutor") {
    const marker = " (avaliação de IA). ";
    const end = detail.indexOf(marker);
    if (end >= 0) return `${localizeTutorText(detail.slice(0, end), lang)} (${translate(lang, "AI assessment")}). ${detail.slice(end + marker.length)}`;
  }
  if (kind === "production" || kind === "review") {
    const end = detail.lastIndexOf(" — ");
    if (end >= 0) return `${localizeTutorText(detail.slice(0, end), lang)} — ${localizeTutorText(detail.slice(end + 3), lang)}`;
  }
  return detail;
}
