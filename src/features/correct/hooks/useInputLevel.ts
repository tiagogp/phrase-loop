"use client";

import { useEffect, useState } from "react";

/** Live microphone level (0..1) for a stream, with a short decay so meters don't flicker. */
export function useInputLevel(stream: MediaStream | null): number {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!stream || typeof AudioContext === "undefined") return;
    const context = new AudioContext();
    void context.resume().catch(() => undefined);
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    context.createMediaStreamSource(stream).connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    const timer = window.setInterval(() => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) sum += ((sample - 128) / 128) ** 2;
      const next = Math.min(1, Math.sqrt(sum / samples.length) * 4);
      setLevel((prev) => Math.max(next, prev * 0.7));
    }, 80);
    return () => {
      window.clearInterval(timer);
      setLevel(0);
      void context.close().catch(() => undefined);
    };
  }, [stream]);
  return stream ? level : 0;
}
