import { describe, expect, it } from "vitest";
import os from "node:os";
import path from "node:path";
import { modelDirs } from "./data";
import { modelStatus } from "./models";

describe("model manager", () => {
  it("exposes the API status contract with readiness derived from disk", async () => {
    const status = await modelStatus();
    expect(status).toMatchObject({
      loading_model: false,
      downloading_model: false,
      loading_kokoro: false,
      loading_whisper: false,
      error: null,
    });
    // `ready` is no longer hardcoded — it mirrors whether the TTS model is
    // actually installed, so the apkg flow can gate on a truthful signal.
    expect(typeof status.kokoro_installed).toBe("boolean");
    expect(status.ready).toBe(status.kokoro_installed);
  });

  it("checks the Electron userData model directory on Linux", () => {
    if (process.platform !== "linux" || process.env.PHRASELOOP_DATA_DIR) return;

    expect(modelDirs()).toContain(path.join(os.homedir(), ".config", "PhraseLoop", "models", "native"));
  });

  it("checks bundled models even when Electron sets a writable data dir", () => {
    const previousDataDir = process.env.PHRASELOOP_DATA_DIR;
    const previousBundledDir = process.env.PHRASELOOP_BUNDLED_MODELS_DIR;
    const userDataDir = path.join(os.tmpdir(), "phraseloop-user-data");
    const bundledModelsDir = path.join(os.tmpdir(), "phraseloop-bundled-models");
    process.env.PHRASELOOP_DATA_DIR = userDataDir;
    process.env.PHRASELOOP_BUNDLED_MODELS_DIR = bundledModelsDir;
    try {
      expect(modelDirs()).toEqual([
        path.join(userDataDir, "models", "native"),
        bundledModelsDir,
      ]);
    } finally {
      if (previousDataDir === undefined) delete process.env.PHRASELOOP_DATA_DIR;
      else process.env.PHRASELOOP_DATA_DIR = previousDataDir;
      if (previousBundledDir === undefined) delete process.env.PHRASELOOP_BUNDLED_MODELS_DIR;
      else process.env.PHRASELOOP_BUNDLED_MODELS_DIR = previousBundledDir;
    }
  });
});
