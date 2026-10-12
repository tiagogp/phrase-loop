#!/usr/bin/env node
// Opens PhraseLoop from a source checkout. Runs the same on macOS, Linux and
// Windows, so it replaces the old shell launcher.
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (!existsSync(path.join(root, "node_modules"))) {
  console.error("  [setup] node_modules not found.");
  console.error("          Run: yarn install");
  process.exit(1);
}

const require = createRequire(import.meta.url);
let electronBinary;
try {
  // The electron package exports the path to this platform's executable.
  electronBinary = require("electron");
} catch {
  console.error("  [setup] Electron binary is missing.");
  console.error("          Run: yarn install (or node node_modules/electron/install.js)");
  process.exit(1);
}

console.log("\n  PhraseLoop - Electron\n");
console.log("  [app] Opening Electron window...");
console.log("        The launcher will start the native-capable frontend on :3000.\n");

const env = { ...process.env, TTS_PROJECT_ROOT: root };
// Electron must not start in plain Node mode, even when the caller's shell set it.
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronBinary, [path.join(root, "electron", "main.js")], {
  cwd: root,
  env,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
