"use client";

import { useSyncExternalStore } from "react";
import type { DiscoveryId } from "./experience";

const KEY = "phraseloop.experience.v1";
const EVENT = "phraseloop:experience-preferences";
let fallback = "";
function read() {
  try { return localStorage.getItem(KEY) ?? fallback; } catch { return fallback; }
}
function parse(raw: string): { fullNavigation: boolean; dismissed: DiscoveryId[] } {
  try {
    const value = JSON.parse(raw);
    return { fullNavigation: value?.fullNavigation === true,
      dismissed: Array.isArray(value?.dismissed) ? value.dismissed.filter((id: unknown) => ["review", "content", "conversation"].includes(String(id))) : [] };
  } catch { return { fullNavigation: false, dismissed: [] }; }
}
function save(update: Partial<ReturnType<typeof parse>>) {
  fallback = JSON.stringify({ ...parse(read()), ...update });
  try { localStorage.setItem(KEY, fallback); } catch { /* Keep this session usable if persistence is unavailable. */ }
  window.dispatchEvent(new Event(EVENT));
}
function subscribe(listener: () => void) {
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", listener);
  return () => { window.removeEventListener(EVENT, listener); window.removeEventListener("storage", listener); };
}
export function useExperiencePreferences() {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  return parse(raw);
}
export function setFullNavigation(fullNavigation: boolean) { save({ fullNavigation }); }
export function dismissDiscovery(id: DiscoveryId) { save({ dismissed: [...new Set([...parse(read()).dismissed, id])] }); }
