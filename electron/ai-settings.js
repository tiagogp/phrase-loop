/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");

const LEGACY_SECRET_PREFIX = "safeStorage:v1:";

// Never unlock the OS keychain. Keep legacy ciphertext on disk until the user
// replaces/removes that key, but never advertise or send it as a usable API key.
function localSecret(value) {
  return typeof value === "string" && value.trim() && !value.startsWith(LEGACY_SECRET_PREFIX)
    ? value
    : undefined;
}

function createAiSettingsStore(file) {
  function read() {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function publicSettings() {
    const { anthropicApiKey, openaiApiKey, openrouterApiKey, ...settings } = read();
    return {
      ...settings,
      configuredProviders: {
        claude: Boolean(localSecret(anthropicApiKey)),
        openai: Boolean(localSecret(openaiApiKey)),
        openrouter: Boolean(localSecret(openrouterApiKey)),
      },
    };
  }

  function save(settings) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    // Restrict an existing file before writing credentials into it, too.
    if (fs.existsSync(file)) fs.chmodSync(file, 0o600);
    fs.writeFileSync(file, `${JSON.stringify(settings, null, 2)}\n`, { mode: 0o600 });
  }

  return { read, publicSettings, save };
}

module.exports = { createAiSettingsStore, localSecret };
