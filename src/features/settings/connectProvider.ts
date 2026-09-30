import type { ProviderKind } from "@/lib/cards/provider";
import type { AiSettingsPatch, AiSettingsSaveResult } from "@/types/aiSettings";

/** Validate the draft before saving credentials or changing the default. */
export async function connectProvider(
  provider: ProviderKind,
  draft: AiSettingsPatch,
  test: (provider: ProviderKind, draft: AiSettingsPatch) => Promise<{ ok: boolean; detail: string }>,
  save: (patch: AiSettingsPatch) => Promise<AiSettingsSaveResult>,
) {
  const checked = await test(provider, draft);
  if (!checked.ok) return checked;
  return save({ ...draft, defaultProvider: provider });
}
