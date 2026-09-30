import { isLevelAtLeast } from "@/features/discover/levels";
import type { LearningProfile } from "@/features/settings/learningProfile";

/** Language the interface chrome is rendered in. Defaults to English. */
export type UiLang = string;

export const DEFAULT_UI_LANG: UiLang = "en";

/** From B1 onward, English immersion takes precedence over a saved preference. */
export function resolveInterfaceLang(profile: Pick<LearningProfile, "level" | "nativeLang" | "interfaceLang">): UiLang {
  if (isLevelAtLeast(profile.level, "B1")) return DEFAULT_UI_LANG;
  return profile.interfaceLang ?? (profile.nativeLang === "pt" ? "pt" : DEFAULT_UI_LANG);
}
