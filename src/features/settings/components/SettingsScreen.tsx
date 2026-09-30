"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Select from "@/components/ui/Select";
import { ENGLISH_LEVELS } from "@/features/discover/constants";
import type { EnglishLevel } from "@/features/discover/types";
import {
  DEFAULT_LEARNING_PROFILE,
  getLearningProfile,
  saveLearningProfile,
  subscribeToProfile,
} from "@/features/settings/learningProfile";
import { useAiSettings } from "@/features/settings/context/AiSettingsContext";
import type { ProviderKind } from "@/lib/cards/provider";
import type { AiSettingsPatch, ProviderStatus } from "@/types/aiSettings";
import { connectProvider } from "../connectProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { Notice } from "@/components/ui/Notice";
import { StatusPill, type StatusPillProps } from "@/components/ui/StatusPill";
import {
  exportLocalBackup,
  restoreLocalBackup,
  validateLocalBackup,
  wipeLocalData,
  type BackupValidationResult,
} from "@/lib/store/repository";
import type { StoreName } from "@/lib/store/db";
import { useT } from "@/i18n/I18nProvider";

type StatusTone = NonNullable<StatusPillProps["tone"]>;

const PROVIDER_COPY: Record<ProviderKind, string> = {
  ollama:
    "Private and on-device. Optional for custom content.",
  claude:
    "Cloud AI from Anthropic. Your learning content is sent to Anthropic.",
  openai: "Cloud AI from OpenAI. Your learning content is sent to OpenAI.",
  openrouter:
    "Cloud AI routed through OpenRouter (default model openrouter/fusion). Your learning content is sent to OpenRouter.",
};

function statusLabel(provider: ProviderStatus): string {
  if (provider.state === "connected") return "Connected";
  if (provider.state === "offline") return "Offline";
  if (provider.state === "invalid") return "Invalid key";
  if (provider.state === "testing") return "Testing";
  return "Not configured";
}

function statusTone(provider: ProviderStatus): StatusTone {
  if (provider.state === "connected") return "success";
  if (provider.state === "offline" || provider.state === "invalid")
    return "danger";
  return "default";
}

// A single confirmation the first time any cloud key is saved, not a per-call modal —
// once acknowledged (or once any cloud provider is already configured), never ask again.
const CLOUD_CONSENT_KEY = "phraseloop:cloud-consent-ack";

function hasCloudConsent(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(CLOUD_CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

function recordCloudConsent(): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(CLOUD_CONSENT_KEY, "1");
  } catch {
    // best-effort only; worst case the confirmation is shown again next time
  }
}

export default function SettingsScreen({
  onBack,
  onOpenTools,
  onOpenC1,
  showAdvancedAi = true,
}: {
  onBack: () => void;
  onOpenTools?: () => void;
  onOpenC1?: () => void;
  showAdvancedAi?: boolean;
}) {
  const { t } = useT();
  const { settings, loading, save, test, refresh } = useAiSettings();
  const restoreInputRef = useRef<HTMLInputElement | null>(null);
  const [ollamaUrlDraft, setOllamaUrl] = useState<string | null>(null);
  const [ollamaModelDraft, setOllamaModel] = useState<string | null>(null);
  const ollamaUrl = ollamaUrlDraft ?? settings.ollama.baseUrl;
  const ollamaModel = ollamaModelDraft ?? (settings.ollama.model || settings.ollama.models[0] || "");
  const [selectedProvider, setSelectedProvider] = useState<ProviderKind | null>(null);
  const selected = selectedProvider ?? settings.defaultProvider;
  const [connected, setConnected] = useState<ProviderKind | null>(null);
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [testResults, setTestResults] = useState<
    Partial<Record<ProviderKind, boolean>>
  >({});
  const [restoreDraft, setRestoreDraft] = useState<{
    fileName: string;
    raw: unknown;
    validation: BackupValidationResult;
  } | null>(null);
  const [dataPath, setDataPath] = useState<string | null>(null);
  const learnerLevel = useSyncExternalStore(
    subscribeToProfile,
    () => getLearningProfile().level,
    () => DEFAULT_LEARNING_PROFILE.level,
  );

  useEffect(() => {
    let canceled = false;
    void fetch("/api/data")
      .then((res) => (res.ok ? (res.json() as Promise<{ path?: unknown }>) : null))
      .then((data) => {
        if (!canceled && typeof data?.path === "string") setDataPath(data.path);
      })
      .catch(() => {});
    return () => {
      canceled = true;
    };
  }, []);
  const changeLearnerLevel = (value: string) => {
    saveLearningProfile({ level: value as EnglishLevel });
  };

  const run = async (
    name: string,
    action: () => Promise<{ ok: boolean; error?: string; detail?: string }>,
  ) => {
    setBusy(name);
    setNotice(null);
    try {
      const result = await action();
      setNotice({ ok: result.ok, text: result.detail || result.error || (result.ok ? t("Saved.") : t("Something went wrong.")) });
    } catch {
      setNotice({ ok: false, text: t("Could not connect. Check your settings and try again.") });
    } finally {
      setBusy(null);
    }
  };

  const connect = (kind: ProviderKind, draft: AiSettingsPatch, clear?: () => void) =>
    run(`connect-${kind}`, async () => {
      setConnected(null);
      const result = await connectProvider(kind, draft, test, save);
      setTestResults(current => ({ ...current, [kind]: result.ok }));
      if (result.ok) {
        clear?.();
        setConnected(kind);
        return { ok: true, detail: t("Connected! This AI is ready for your tutor, conversations, and content.") };
      }
      return result;
    });

  const downloadBackup = async () => {
    setBusy("backup");
    setNotice(null);
    try {
      const backup = await exportLocalBackup();
      const blob = new Blob([`${JSON.stringify(backup, null, 2)}\n`], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `phraseloop-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setNotice({ ok: true, text: t("Backup downloaded.") });
    } catch {
      setNotice({ ok: false, text: t("Could not export local data.") });
    } finally {
      setBusy(null);
    }
  };

  const readBackupFile = async (file: File) => {
    setBusy("restore-read");
    setNotice(null);
    setRestoreDraft(null);
    try {
      const raw = JSON.parse(await file.text()) as unknown;
      const validation = validateLocalBackup(raw);
      setRestoreDraft({ fileName: file.name, raw, validation });
      setNotice({
        ok: validation.ok,
        text: validation.ok
          ? t("Backup validated. Review the dry run before restoring.")
          : validation.errors[0] ?? t("Backup could not be validated."),
      });
    } catch {
      setNotice({ ok: false, text: t("Could not read this backup file.") });
    } finally {
      setBusy(null);
    }
  };

  const restoreBackup = async () => {
    if (!restoreDraft?.validation.ok) return;
    if (
      !window.confirm(
        t("Restore this backup? Matching records will be updated, and nothing will be deleted."),
      )
    ) {
      return;
    }
    setBusy("restore");
    setNotice(null);
    try {
      const result = await restoreLocalBackup(restoreDraft.raw);
      if (!result.ok) {
        setNotice({ ok: false, text: result.errors[0] ?? t("Backup could not be restored.") });
        return;
      }
      setRestoreDraft(null);
      setNotice({
        ok: true,
        text: t("{count} records restored.", { count: result.totalRecords }),
      });
    } catch {
      setNotice({ ok: false, text: t("Could not restore local data.") });
    } finally {
      setBusy(null);
    }
  };

  const deleteAllData = async () => {
    if (
      !window.confirm(
        t(
          "Delete ALL local data? Practice phrases, reviews, mistakes, progress, and preferences will be permanently removed from this computer. Download a backup first if you might want them back.",
        ),
      )
    ) {
      return;
    }
    setBusy("wipe");
    setNotice(null);
    try {
      const response = await fetch("/api/data", { method: "DELETE" }).catch(() => null);
      if (!response || !response.ok) throw new Error("server data deletion failed");
      await wipeLocalData();
      window.location.reload();
    } catch {
      setNotice({ ok: false, text: t("Could not delete all local data. Try again.") });
      setBusy(null);
    }
  };

  const renderedStatus = (
    provider: ProviderStatus,
  ): { label: string; tone: StatusTone } => {
    if (busy === `connect-${provider.kind}`)
      return { label: "Testing", tone: "default" };
    if (testResults[provider.kind] === false) {
      return {
        label: "Connection failed",
        tone: "danger",
      };
    }
    if (testResults[provider.kind] === true)
      return { label: "Connected", tone: "success" };
    return { label: statusLabel(provider), tone: statusTone(provider) };
  };

  const cloudCard = (
    kind: "claude" | "openai" | "openrouter",
    key: string,
    setKey: (value: string) => void,
  ) => {
    const provider = settings.providers.find((item) => item.kind === kind);
    const keyField: "anthropicApiKey" | "openaiApiKey" | "openrouterApiKey" =
      kind === "claude" ? "anthropicApiKey" : kind === "openrouter" ? "openrouterApiKey" : "openaiApiKey";
    const shownStatus = provider ? renderedStatus(provider) : null;
    return (
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold text-ink">{provider?.label ?? kind}</h3>
          {shownStatus && <StatusPill tone={shownStatus.tone}>{t(shownStatus.label)}</StatusPill>}
        </div>
        <p className="text-sm text-ink-soft">{t(PROVIDER_COPY[kind])}</p>
        <p className="text-sm text-ink-muted">{t("Create an API key in your provider account, then paste it below. It is not your account password.")}</p>
        <Field label={t("API key")} htmlFor={`${kind}-key`}>
          <Input
            id={`${kind}-key`}
            type="password"
            autoComplete="off"
            value={key}
            onChange={(event) => {
              setKey(event.target.value);
              setConnected(null);
              setTestResults(current => ({ ...current, [kind]: undefined }));
            }}
            placeholder={
              provider?.configured
                ? settings.storage === "system"
                  ? t("Saved securely — enter a new key to replace it")
                  : t("Saved locally — enter a new key to replace it")
                : t("Paste your API key")
            }
            disabled={!settings.writable || busy !== null}
          />
        </Field>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="primary"
            disabled={!settings.writable || (!key.trim() && !provider?.configured) || busy !== null}
            onClick={() => {
              const anyCloudConfigured = settings.providers.some(
                (item) => item.kind !== "ollama" && item.configured,
              );
              if (!anyCloudConfigured && !hasCloudConsent()) {
                if (
                  !window.confirm(
                    t(
                      "Connecting a cloud AI sends your practice content — phrases, mistakes, conversations — to {provider}. Continue?",
                      { provider: provider?.label ?? kind },
                    ),
                  )
                ) {
                  return;
                }
                recordCloudConsent();
              }
              void connect(kind, key.trim() ? { [keyField]: key.trim() } : {}, () => setKey(""));
            }}
          >
            {busy === `connect-${kind}` ? t("Connecting…") : t("Connect and use this AI")}
          </Button>
          {provider?.configured && (
            <Button
              variant="danger"
              disabled={!settings.writable || busy !== null}
              onClick={() => {
                if (
                  !window.confirm(
                    t("Remove the saved {provider} credential?", { provider: provider.label }),
                  )
                )
                  return;
                void run(`remove-${kind}`, async () => {
                  const result = await save({ [keyField]: null } as AiSettingsPatch);
                  if (result.ok) {
                    setConnected(null);
                    setTestResults(current => ({ ...current, [kind]: undefined }));
                  }
                  return result;
                });
              }}
            >
              {t("Remove key")}
            </Button>
          )}
        </div>
      </Card>
    );
  };

  const ollamaProvider = settings.providers.find(provider => provider.kind === "ollama");
  const ollamaStatus = ollamaProvider ? renderedStatus(ollamaProvider) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <div className="mb-6 space-y-4 border-b border-line pb-5">
        <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 min-h-9">
          <span aria-hidden="true">←</span>
          {t("Back to PhraseLoop")}
        </Button>
        <PageHeader
          title={t("Settings")}
          description={showAdvancedAi
            ? t("Connect your AI and manage your learning preferences.")
            : t("Manage your local PhraseLoop data.")}
        />
      </div>

      {notice && (
        <Notice
          tone={notice.ok ? "success" : "error"}
          role="status"
          className="mb-5"
        >
          {notice.text}
        </Notice>
      )}

      {!settings.writable && !loading && (
        <Notice role="note" className="mb-5">
          {t("Settings are read-only in the browser. Configure providers with environment variables or open the desktop app.")}
        </Notice>
      )}

      <nav aria-label={t("Settings sections")} className="mb-5 flex flex-wrap gap-2">
        {showAdvancedAi && <a href="#settings-ai" className="inline-flex min-h-10 items-center rounded-md border border-accent/30 bg-accent/5 px-3 text-sm font-medium text-accent">{t("Connect an AI")}</a>}
        <a href="#settings-data" className="inline-flex min-h-10 items-center rounded-md border border-line bg-card px-3 text-sm font-medium text-ink-soft transition-colors hover:border-line-strong hover:text-ink">
          {t("Data and privacy")}
        </a>
        {(showAdvancedAi || onOpenTools || onOpenC1) && (
          <a href="#settings-advanced" className="inline-flex min-h-10 items-center rounded-md border border-line bg-card px-3 text-sm font-medium text-ink-soft transition-colors hover:border-line-strong hover:text-ink">
            {t("Tools")}
          </a>
        )}
        <a href="#settings-profile" className="inline-flex min-h-10 items-center rounded-md border border-line bg-card px-3 text-sm font-medium text-ink-soft transition-colors hover:border-line-strong hover:text-ink">
          {t("Learner profile")}
        </a>
      </nav>

      {showAdvancedAi && (
        <section id="settings-ai" aria-labelledby="connect-ai-title" className="mb-8 scroll-mt-4 space-y-4">
          <div>
            <h2 id="connect-ai-title" className="text-xl font-semibold text-ink">{t("Connect an AI")}</h2>
            <p className="mt-2 text-sm text-ink-soft">{t("Choose a provider, connect it, and return to your activity.")}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label={t("Choose an AI provider")}>
            {settings.providers.map(provider => <Button key={provider.kind} variant={selected === provider.kind ? "primary" : "secondary"} aria-pressed={selected === provider.kind} disabled={loading || busy !== null} onClick={() => { setSelectedProvider(provider.kind); setNotice(null); setConnected(null); }}>{provider.label}</Button>)}
          </div>
          {loading && <p role="status" className="text-sm text-ink-muted">{t("Loading…")}</p>}
          {selected === "ollama" && <Card className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-ink">Ollama · {t("On this computer")}</h3>
              {ollamaStatus && <StatusPill tone={ollamaStatus.tone}>{t(ollamaStatus.label)}</StatusPill>}
            </div>
            <p className="text-sm text-ink-soft">{t("Open Ollama and download a model first. Keep it running, choose the model below, and connect. No API key is needed.")}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("Server address")} htmlFor="ollama-url">
                <Input
                  id="ollama-url"
                  value={ollamaUrl}
                  onChange={(event) => setOllamaUrl(event.target.value)}
                  disabled={!settings.writable || busy !== null}
                />
              </Field>
              <Field label={t("AI model")} htmlFor="ollama-model">
                {settings.ollama.models.length > 0 ? (
                  <Select
                    value={ollamaModel || settings.ollama.models[0]}
                    onChange={setOllamaModel}
                    options={settings.ollama.models.map((model) => ({
                      value: model,
                      label: model,
                    }))}
                    disabled={!settings.writable || busy !== null}
                  />
                ) : (
                  <Input
                    id="ollama-model"
                    value={ollamaModel}
                    onChange={(event) => setOllamaModel(event.target.value)}
                    placeholder="llama3.1"
                    disabled={!settings.writable || busy !== null}
                  />
                )}
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="primary"
                disabled={!settings.writable || busy !== null || !ollamaModel.trim()}
                onClick={() => void connect("ollama", { ollamaBaseUrl: ollamaUrl.trim(), ollamaModel: ollamaModel.trim() })}
              >
                {busy === "connect-ollama" ? t("Connecting…") : t("Connect and use this AI")}
              </Button>
              <Button
                variant="secondary"
                disabled={busy !== null}
                onClick={() => void refresh()}
              >
                {t("Refresh models")}
              </Button>
            </div>
          </Card>}

          <div className="space-y-3">
            {selected === "openrouter" && cloudCard("openrouter", openrouterKey, setOpenrouterKey)}
            {selected === "claude" && cloudCard("claude", anthropicKey, setAnthropicKey)}
            {selected === "openai" && cloudCard("openai", openaiKey, setOpenaiKey)}
          </div>
          {connected === selected && <Button onClick={onBack}>{t("Done — return to my activity")} →</Button>}
        </section>
      )}

      <Card id="settings-data" className="mb-4 scroll-mt-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-medium text-ink">{t("Local data")}</h3>
            <p className="mt-1 text-sm text-ink-muted">
              {t("Back up or restore practice phrases, reviews, and source material.")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={busy !== null}
              onClick={() => void downloadBackup()}
            >
              {busy === "backup" ? t("Exporting...") : t("Download backup")}
            </Button>
            <Button
              variant="secondary"
              disabled={busy !== null}
              onClick={() => restoreInputRef.current?.click()}
            >
              {t("Validate restore")}
            </Button>
          </div>
        </div>
        <input
          ref={restoreInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) void readBackupFile(file);
          }}
        />
        {restoreDraft && (
          <div className="mt-4 rounded-lg border border-line bg-surface p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{restoreDraft.fileName}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {restoreDraft.validation.ok
                    ? t("Dry run passed: {count} records can be restored.", {
                        count: restoreDraft.validation.totalRecords,
                      })
                    : t("Dry run failed. Fix the backup file before restoring.")}
                </p>
                {restoreDraft.validation.exportedAt && (
                  <p className="mt-1 text-[11px] text-ink-muted">
                    {t("Exported at {date}", { date: restoreDraft.validation.exportedAt })}
                  </p>
                )}
              </div>
              <Button
                variant="primary"
                size="sm"
                disabled={!restoreDraft.validation.ok || busy !== null}
                onClick={() => void restoreBackup()}
              >
                {busy === "restore" ? t("Restoring...") : t("Restore backup")}
              </Button>
            </div>
            <BackupCounts counts={restoreDraft.validation.counts} />
            {restoreDraft.validation.errors.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-danger">
                {restoreDraft.validation.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            )}
            {restoreDraft.validation.ok && (
              <p className="mt-3 text-xs text-ink-muted">
                {t("Restore adds or updates matching records by ID. It does not delete anything currently in PhraseLoop.")}
              </p>
            )}
          </div>
        )}
      </Card>

      <Card className="mb-4 p-5">
        <h3 className="font-medium text-ink">{t("Where your data lives")}</h3>
        <p className="mt-1 text-sm text-ink-muted">
          {t("Everything stays on this computer. Practice phrases, reviews, mistakes, and progress live in the app's local database — nothing is sent anywhere unless you connect a cloud AI.")}
        </p>
        {dataPath && (
          <div className="mt-3">
            <p className="text-xs text-ink-muted">
              {t("Imported audio and downloaded voice models are kept in this folder:")}
            </p>
            <code className="mt-1 block overflow-x-auto rounded border border-line bg-surface px-2.5 py-1.5 text-xs text-ink">
              {dataPath}
            </code>
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="max-w-sm text-xs text-ink-muted">
            {t("Deleting removes everything above from this computer. Downloaded voice models stay — they are not personal data.")}
          </p>
          <Button
            variant="danger"
            disabled={busy !== null}
            onClick={() => void deleteAllData()}
          >
            {busy === "wipe" ? t("Deleting...") : t("Delete all local data")}
          </Button>
        </div>
      </Card>

      <section id="settings-advanced" className="scroll-mt-4">


      {onOpenTools && (
        <Card className="mt-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-medium text-ink">{t("Advanced tools")}</h3>
              <p className="mt-1 text-sm text-ink-muted">
                {t("Export to Anki, text-to-speech, and theme phrase lists.")}
              </p>
            </div>
            <Button variant="secondary" onClick={onOpenTools}>
              {t("Open tools")}
            </Button>
          </div>
        </Card>
      )}

      {onOpenC1 && (
        <Card className="mt-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-medium text-ink">{t("C1 diagnosis (experimental)")}</h3>
              <p className="mt-1 text-sm text-ink-muted">
                {t("Register, naturalness, and collocation feedback for past B1/B2 writing.")}
              </p>
            </div>
            <Button variant="secondary" onClick={onOpenC1}>
              {t("Open C1 diagnosis")}
            </Button>
          </div>
        </Card>
      )}
      </section>

      <Card id="settings-profile" className="mt-4 scroll-mt-4 p-5">
        <div>
          <h3 className="font-medium text-ink">{t("Learner profile")}</h3>
          <p className="mt-1 text-sm text-ink-muted">
            {t("Adjust your English level as you progress. Lessons and corrections follow it.")}
          </p>
        </div>
        <Field label={t("English level")} className="mt-3 max-w-52">
          <Select value={learnerLevel} onChange={changeLearnerLevel} options={ENGLISH_LEVELS} />
        </Field>
        <p className="mt-2 text-xs text-ink-muted">
          {t("From B1 the interface switches to English.")}
        </p>
      </Card>
    </div>
  );
}

function BackupCounts({ counts }: { counts: Record<StoreName, number> }) {
  const nonZero = Object.entries(counts).filter(([, count]) => count > 0);
  if (nonZero.length === 0) return null;
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {nonZero.map(([store, count]) => (
        <div key={store} className="flex items-center justify-between gap-2 rounded border border-line bg-card px-2.5 py-1.5">
          <span className="truncate text-xs text-ink-muted">{store}</span>
          <span className="text-xs font-medium tabular-nums text-ink">{count}</span>
        </div>
      ))}
    </div>
  );
}
