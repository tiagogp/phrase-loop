"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveTutorSession } from "./store";
import { requestTutor } from "./api";
import type { TutorRequest, TutorSession } from "./types";

/** Immediate draft updates, serialized durable writes, and explicit failure state.
 * No debounce: leaving the workspace does not drop the last characters. */
export function useTutorSession(initial: TutorSession | null) {
  const [session, setSession] = useState(initial);
  const current = useRef(initial);
  const queue = useRef(Promise.resolve());
  const alive = useRef(true);
  const fatalRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [fatal, setFatal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingAction, setPendingAction] = useState<TutorRequest["action"] | null>(null);
  const busy = pendingAction !== null;
  const request = useRef<AbortController | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; request.current?.abort(); }; }, []);

  const commit = useCallback((update: (previous: TutorSession | null) => TutorSession) => {
    if (fatalRef.current) return Promise.reject(new Error("Reabra a sessão antes de continuar."));
    const prev = current.current;
    const value = { ...update(prev), revision: (prev?.revision ?? 0) + 1, updatedAt: Date.now() };
    current.current = value;
    setSession(value);
    setSaving(true);
    const pending = queue.current.then(() => saveTutorSession(value, prev?.revision ?? 0));
    queue.current = pending;
    void pending.then(() => { if (alive.current && queue.current === pending) setSaving(false); }, e => {
      fatalRef.current = true;
      if (alive.current) { setSaving(false); setFatal(true); setError(e instanceof Error ? e.message : "Não foi possível salvar. Copie sua resposta antes de sair."); }
    });
    return pending;
  }, []);

  const call = useCallback(async (input: TutorRequest) => {
    if (request.current || fatalRef.current) return null;
    const controller = new AbortController();
    request.current = controller;
    setPendingAction(input.action); setError(null);
    try {
      await queue.current;
      if (controller.signal.aborted) return null;
      const result = await requestTutor(input, controller.signal);
      return controller.signal.aborted || !alive.current ? null : result;
    } catch (e) {
      if (alive.current && !controller.signal.aborted) setError(e instanceof Error ? e.message : "O tutor não respondeu. Tente novamente.");
      return null;
    } finally {
      request.current = null;
      if (alive.current) setPendingAction(null);
    }
  }, []);

  return { session, commit, call, busy, pendingAction, saving, fatal, error, setError, cancel: () => request.current?.abort(), current };
}
