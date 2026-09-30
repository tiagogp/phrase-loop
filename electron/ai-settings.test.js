import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiSettingsStore, localSecret } from "./ai-settings";

describe("desktop AI settings without keychain access", () => {
  let directory;
  let file;
  let store;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "phraseloop-settings-"));
    file = path.join(directory, "ai-settings.json");
    store = createAiSettingsStore(file);
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it("persists usable keys across store instances with owner-only permissions", () => {
    store.save({ openaiApiKey: "test-api-key", defaultProvider: "openai" });
    const reopened = createAiSettingsStore(file);
    expect(localSecret(reopened.read().openaiApiKey)).toBe("test-api-key");
    expect(reopened.publicSettings()).toEqual({
      defaultProvider: "openai",
      configuredProviders: { claude: false, openai: true, openrouter: false },
    });
    if (process.platform !== "win32") {
      expect(fs.statSync(file).mode & 0o777).toBe(0o600);
      fs.chmodSync(file, 0o644);
      store.save({ openaiApiKey: "replacement" });
      expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    }
  });

  it("never exposes API keys in public settings", () => {
    store.save({
      anthropicApiKey: "test-claude",
      openaiApiKey: "test-openai",
      openrouterApiKey: "test-openrouter",
      ollamaModel: "local-model",
    });
    expect(store.publicSettings()).toEqual({
      ollamaModel: "local-model",
      configuredProviders: { claude: true, openai: true, openrouter: true },
    });
  });

  it("preserves legacy ciphertext without treating it as a key, until replaced", () => {
    const legacy = "safeStorage:v1:bGVnYWN5";
    store.save({ anthropicApiKey: legacy, openaiApiKey: "usable-key" });
    store.save({ ...store.read(), ollamaModel: "new-model" });
    expect(store.read().anthropicApiKey).toBe(legacy);
    expect(localSecret(store.read().anthropicApiKey)).toBeUndefined();
    expect(store.publicSettings().configuredProviders).toEqual({
      claude: false, openai: true, openrouter: false,
    });
    expect(JSON.stringify(store.publicSettings())).not.toContain(legacy);

    store.save({ ...store.read(), anthropicApiKey: "replacement-key" });
    expect(localSecret(store.read().anthropicApiKey)).toBe("replacement-key");
    expect(store.publicSettings().configuredProviders.claude).toBe(true);
  });

  it("handles missing or malformed settings without requesting a password", () => {
    expect(store.read()).toEqual({});
    for (const content of ["invalid json", "null", "[]", "42"]) {
      fs.writeFileSync(file, content);
      expect(store.read()).toEqual({});
    }
  });

  it.each([undefined, null, "", "  ", 123, {}, "safeStorage:v1:invalid"])(
    "does not serve an unusable stored value (%j)",
    (value) => expect(localSecret(value)).toBeUndefined(),
  );
});
