"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadTutorMemory, type TutorMemory } from "./store";

export function useTutorMemory() {
  const [memory, setMemory] = useState<TutorMemory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const version = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++version.current;
    try {
      const next = await loadTutorMemory();
      if (request === version.current) { setMemory(next); setError(null); }
    } catch (e) { if (request === version.current) setError(e instanceof Error ? e.message : "Não foi possível carregar o tutor."); }
  }, []);
  useEffect(() => {
    const token = version;
    const reload = () => { if (!document.hidden) void refresh(); };
    void Promise.resolve().then(refresh);
    const events = ["phraseloop:tutor-updated", "phraseloop:performance-evidence", "phraseloop:backup-restored", "phraseloop:lesson-saved", "phraseloop:profile-updated", "focus"];
    events.forEach(event => window.addEventListener(event, reload));
    document.addEventListener("visibilitychange", reload);
    const timer = window.setInterval(reload, 60_000);
    return () => { token.current++; events.forEach(event => window.removeEventListener(event, reload)); document.removeEventListener("visibilitychange", reload); window.clearInterval(timer); };
  }, [refresh]);
  return { memory, error, refresh };
}
