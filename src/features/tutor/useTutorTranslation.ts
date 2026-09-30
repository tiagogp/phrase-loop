"use client";

import { useCallback } from "react";
import { useT } from "@/i18n/I18nProvider";
import { localizeTutorText } from "./localization";

export function useTutorTranslation() {
  const { t, lang } = useT();
  const localize = useCallback((text: string) => localizeTutorText(text, lang), [lang]);
  return { t, lang, localize };
}
