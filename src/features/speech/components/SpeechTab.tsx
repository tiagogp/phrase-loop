"use client";

import { useState } from "react";
import { Segmented } from "@/components/ui/Segmented";

import AnkiExporter from "@/features/speech/components/AnkiExporter";
import AudioPlayer from "@/components/ui/AudioPlayer";
import ThemePhraseGenerator from "@/features/speech/components/ThemePhraseGenerator";
import HistoryPanel from "@/features/speech/components/HistoryPanel";
import LocalModelNotice from "@/features/speech/components/LocalModelNotice";
import Disclosure from "@/components/ui/Disclosure";
import Select from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Label, Textarea } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import {
  KOKORO_VOICE_OPTIONS,
  toKokoroVoice,
} from "@/features/speech/context/TtsSettingsContext";
import {
  EXAMPLE_TEXT,
  MAX_CHARS,
  useSpeechGenerator,
} from "@/features/speech/hooks/useSpeechGenerator";
import { useKokoroModel, type LocalModelState } from "@/features/speech/hooks/useLocalModel";
import { useT } from "@/i18n/I18nProvider";

function AudioStudio({ kokoroModel }: { kokoroModel?: LocalModelState } = {}) {
  const { t } = useT();
  const localKokoro = useKokoroModel();
  const kokoro = kokoroModel ?? localKokoro;
  const {
    audioUrl,
    clearHistory,
    downloadingModel,
    error,
    generate,
    history,
    loading,
    restoreEntry,
    setSpeed,
    setText,
    setVoice,
    speed,
    text,
    voice,
  } = useSpeechGenerator();

  const canGenerate = !loading && kokoro.ready === true && text.trim().length > 0;

  return (
    <div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-2 lg:col-span-3">
          <div className="relative">
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value.slice(0, MAX_CHARS))}
              aria-label={t("English text")}
              placeholder={t("Type or paste English text here…")}
              rows={6}
              className="bg-card px-4 pt-3 pb-9 leading-relaxed lg:min-h-80"
            />
            <span
              className={cn(
                "absolute bottom-3 right-3 text-xs",
                text.length > MAX_CHARS * 0.9 ? "text-accent" : "text-ink-muted",
              )}
            >
              {text.length} / {MAX_CHARS}
            </span>
          </div>

          <div className="flex gap-1">
            <button
              onClick={() => setText("")}
              type="button"
              className="min-h-11 cursor-pointer rounded px-2 py-1 text-xs text-ink-muted transition-colors hover:text-ink"
            >
              {t("Clear")}
            </button>
            <button
              onClick={() => setText(EXAMPLE_TEXT)}
              type="button"
              className="min-h-11 cursor-pointer rounded px-2 py-1 text-xs text-ink-muted transition-colors hover:text-ink"
            >
              {t("Load example")}
            </button>
          </div>
        </div>

        <div className="lg:col-span-2">
          <Card className="space-y-5 p-5">
            <Field label={t("Voice")}>
              <Select
                value={voice}
                onChange={(value) => setVoice(toKokoroVoice(value))}
                options={KOKORO_VOICE_OPTIONS}
                disabled={loading}
              />
            </Field>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="mb-0" htmlFor="kokoro-speed">{t("Speed")}</Label>
                <span className="text-sm font-semibold tabular-nums text-accent">{speed.toFixed(2)}×</span>
              </div>
              <input
                id="kokoro-speed"
                type="range"
                min={0.5}
                max={2.0}
                step={0.05}
                value={speed}
                onChange={(event) => setSpeed(parseFloat(event.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-ink-muted">
                <span>0.5× {t("Slow")}</span>
                <span>1× {t("Normal")}</span>
                <span>2× {t("Fast")}</span>
              </div>
            </div>

            {kokoro.ready === false ? (
              <LocalModelNotice model={kokoro} />
            ) : (
              <Button
                variant="primary"
                size="lg"
                onClick={generate}
                disabled={!canGenerate}
                className="flex items-center justify-center gap-2 py-2.5"
              >
                {loading || kokoro.ready === null ? (
                  <>
                    <Spinner className="h-3.5 w-3.5" />
                    {kokoro.ready === null ? t("Checking voice model…") : t("Generating…")}
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z" />
                    </svg>
                    {t("Generate audio")}
                  </>
                )}
              </Button>
            )}

            {downloadingModel && (
              <div className="flex items-center gap-2 rounded border border-line bg-surface px-3 py-2.5 text-xs text-ink-soft">
                <Spinner className="h-3 w-3 shrink-0" />
                {t("Preparing voices for the first time… this may take a minute.")}
              </div>
            )}

            {error && (
              <Notice tone="error" className="text-xs">
                {error}
              </Notice>
            )}

            {audioUrl && <AudioPlayer key={audioUrl} audioUrl={audioUrl} voiceLabel={`Kokoro · ${voice}`} />}
          </Card>
        </div>
      </div>

      {history.length > 0 && (
        <Disclosure
          title={t("Recent audio")}
          description={t("Replay or restore something you generated earlier.")}
          badge={<span className="text-xs tabular-nums text-ink-muted">{history.length}</span>}
          className="mt-6"
        >
          <HistoryPanel history={history} onRestore={restoreEntry} onClear={clearHistory} embedded />
        </Disclosure>
      )}


    </div>
  );
}


export default function SpeechTab({ kokoroModel, initialTool = "anki" }: { kokoroModel?: LocalModelState; initialTool?: string } = {}) {
  const { t } = useT();
  const [tool, setTool] = useState(initialTool);
  return <div className="space-y-5">
    <Segmented label={t("Kokoro & Anki")} value={tool} onChange={setTool} options={[
      { value: "anki", label: t("Anki deck") },
      { value: "audio", label: t("Generate audio") },
      { value: "themes", label: t("Theme phrases") },
    ]} />
    <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">{t("Generate English audio with Kokoro, export a deck, or create phrases for a situation you want to practice.")}</p>
    <div hidden={tool !== "anki"}><AnkiExporter embedded kokoroModel={kokoroModel} /></div>
    <div hidden={tool !== "audio"}><AudioStudio kokoroModel={kokoroModel} /></div>
    <div hidden={tool !== "themes"}><ThemePhraseGenerator embedded /></div>
  </div>;
}
