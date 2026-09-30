/**
 * Lists the card-generation providers usable in this environment, so the Discover
 * UI can offer "run locally" vs a cloud provider based on which API keys are set.
 */

import { NextResponse } from "next/server";
import { isOllamaReachable } from "@/server/integrations/ollama";
import { isProviderConfigured } from "@/server/aiSettings";
import type { ProviderKind } from "@/lib/cards/provider";
import { PROVIDER_FALLBACK_LABELS } from "@/app/api/cards/_lib/constants";

export const runtime = "nodejs";

export async function GET() {
  const ollamaReachable = await isOllamaReachable();
  const providers = await Promise.all(
    (Object.keys(PROVIDER_FALLBACK_LABELS) as ProviderKind[]).map(async (kind) => {
      const available = kind === "ollama" ? ollamaReachable : isProviderConfigured(kind);
      return { kind, label: PROVIDER_FALLBACK_LABELS[kind], available };
    }),
  );
  return NextResponse.json({ providers });
}
