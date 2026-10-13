"use client";

import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { requestActiveMicrophone } from "@/features/converse/mediaRun";
import { transcribeAudio } from "@/features/correct/api";
import { MAX_CORRECTION_UPLOAD_BYTES } from "@/features/correct/constants";
import { useT } from "@/i18n/I18nProvider";
import { useInputLevel } from "./useInputLevel";

interface UseCorrectionAudioOptions {
  active?: boolean;
  onNote: (note: string | null) => void;
  onText: (updater: (current: string) => string) => void;
  /** Keep the original sample when a caller needs evidence beyond its transcript. */
  onBlob?: (blob: Blob) => void;
  /** Stop an open recording when the current speaking stage reaches its target. */
  maxDurationMs?: number;
}

export function useCorrectionAudio({ onNote, onText, onBlob, maxDurationMs, active = true }: UseCorrectionAudioOptions) {
  const { t } = useT();
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [previousActive, setPreviousActive] = useState(active);
  if (previousActive !== active) {
    setPreviousActive(active);
    if (!active) setRecording(false);
  }
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const level = useInputLevel(recording ? stream : null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const generationRef = useRef(0);
  const activeRef = useRef(active);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const elapsedTimerRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);

  const clearRecordingTimers = useCallback(() => {
    if (stopTimerRef.current !== null) window.clearTimeout(stopTimerRef.current);
    if (elapsedTimerRef.current !== null) window.clearInterval(elapsedTimerRef.current);
    stopTimerRef.current = null;
    elapsedTimerRef.current = null;
  }, []);

  useEffect(() => {
    activeRef.current = active;
    return () => {
      activeRef.current = false;
      generationRef.current += 1;
      if (recorderRef.current) recorderRef.current.onstop = null;
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
      recorderRef.current = null;
      clearRecordingTimers();
    };
  }, [active, clearRecordingTimers]);

  const transcribeBlob = useCallback(async (blob: Blob, filename?: string) => {
    const generation = generationRef.current;
    if (!activeRef.current) return;
    setTranscribing(true);
    onNote(null);
    try {
      const text = await transcribeAudio(blob, filename);
      if (!activeRef.current || generation !== generationRef.current) return;
      if (!text) {
        onNote(t("Couldn't make out any speech in that clip."));
        return;
      }
      onText((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
    } catch (err: unknown) {
      if (activeRef.current && generation === generationRef.current) onNote(err instanceof Error ? err.message : t("Transcription failed."));
    } finally {
      setTranscribing(false);
    }
  }, [onNote, onText, t]);

  const startRecording = useCallback(async () => {
    const generation = generationRef.current;
    if (!activeRef.current) return;
    onNote(null);
    try {
      const stream = await requestActiveMicrophone(() => activeRef.current && generation === generationRef.current);
      if (!stream) return;
      setStream(stream);
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (activeRef.current && generation === generationRef.current && blob.size > 0) {
          onBlob?.(blob);
          void transcribeBlob(blob);
        }
      };
      recorderRef.current = recorder;
      recorder.start();
      recordingStartedAtRef.current = Date.now();
      setRecordingElapsedMs(0);
      elapsedTimerRef.current = window.setInterval(() => {
        if (recordingStartedAtRef.current !== null) {
          setRecordingElapsedMs(Date.now() - recordingStartedAtRef.current);
        }
      }, 250);
      if (maxDurationMs && maxDurationMs > 0) {
        stopTimerRef.current = window.setTimeout(() => {
          if (recorderRef.current === recorder) {
            recorder.stop();
            recorderRef.current = null;
            setRecording(false);
            clearRecordingTimers();
          }
        }, maxDurationMs);
      }
      setRecording(true);
    } catch {
      if (!activeRef.current || generation !== generationRef.current) return;
      onNote(t("Couldn't access the microphone. Check the browser's permission."));
    }
  }, [clearRecordingTimers, maxDurationMs, onBlob, onNote, t, transcribeBlob]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    clearRecordingTimers();
    if (recordingStartedAtRef.current !== null) setRecordingElapsedMs(Date.now() - recordingStartedAtRef.current);
    recordingStartedAtRef.current = null;
    setRecording(false);
  }, [clearRecordingTimers]);

  const onPickFile = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      if (file.size > MAX_CORRECTION_UPLOAD_BYTES) {
        onNote(t("Audio file too large (max 25 MB)."));
        return;
      }
      onBlob?.(file);
      void transcribeBlob(file, file.name);
    },
    [onBlob, onNote, t, transcribeBlob],
  );

  return {
    fileInputRef,
    recording,
    recordingElapsedMs,
    level,
    maxDurationMs,
    transcribing,
    startRecording,
    stopRecording,
    onPickFile,
  };
}
