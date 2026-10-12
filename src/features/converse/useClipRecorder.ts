"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { requestActiveMicrophone } from "@/features/converse/mediaRun";

export interface RecordedClip {
  blob: Blob;
  durationMs: number;
}

/**
 * One microphone clip at a time: `start` opens the mic, `stop` resolves with the clip and how long
 * it ran. Leaving the workspace (`active` false) drops an open recording instead of keeping the
 * mic alive in the background.
 */
export function useClipRecorder(active: boolean) {
  const [recording, setRecording] = useState(false);
  const [previousActive, setPreviousActive] = useState(active);
  if (previousActive !== active) {
    setPreviousActive(active);
    if (!active) setRecording(false);
  }
  const recorderRef = useRef<MediaRecorder | null>(null);
  const startedAtRef = useRef(0);
  const activeRef = useRef(active);
  const pendingRef = useRef<((clip: RecordedClip | null) => void) | null>(null);

  /** Release the mic and any waiting `stop`; React state is reset by the caller. */
  const release = useCallback(() => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder) {
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
      recorder.stream.getTracks().forEach((track) => track.stop());
    }
    pendingRef.current?.(null);
    pendingRef.current = null;
  }, []);

  const drop = useCallback(() => {
    release();
    setRecording(false);
  }, [release]);

  useEffect(() => {
    activeRef.current = active;
    if (!active) release();
  }, [active, release]);
  useEffect(() => release, [release]);

  const start = useCallback(async (): Promise<boolean> => {
    if (recorderRef.current || !activeRef.current) return false;
    const stream = await requestActiveMicrophone(() => activeRef.current);
    if (!stream) return false;
    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      pendingRef.current?.(blob.size > 0 ? { blob, durationMs: Date.now() - startedAtRef.current } : null);
      pendingRef.current = null;
    };
    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    recorder.start();
    setRecording(true);
    return true;
  }, []);

  const stop = useCallback((): Promise<RecordedClip | null> => {
    const recorder = recorderRef.current;
    if (!recorder) return Promise.resolve(null);
    recorderRef.current = null;
    setRecording(false);
    return new Promise((resolve) => {
      pendingRef.current = resolve;
      recorder.stop();
    });
  }, []);

  return { recording, start, stop, cancel: drop };
}
