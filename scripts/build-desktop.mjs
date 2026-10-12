#!/usr/bin/env node
// Single entry point for desktop packages:
//   node scripts/build-desktop.mjs mac       # Apple Silicon .dmg (run on macOS)
//   node scripts/build-desktop.mjs linux     # Linux AppImage (run on Linux)
//   node scripts/build-desktop.mjs windows   # Windows NSIS installer (run on Windows)
//   node scripts/build-desktop.mjs download  # host-OS shareable package + local install
//
// The packaging steps live in electron/*.sh and scripts/make-download.sh, which
// are tested. This wrapper only finds a usable bash for the host. On Windows,
// the bash on PATH is often WSL's launcher, which cannot see the Windows
// toolchain, so Git for Windows' bash is preferred.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TARGETS = {
  mac: { script: "electron/build-app.sh", hosts: ["darwin"] },
  linux: { script: "electron/build-linux.sh", hosts: ["linux"] },
  windows: { script: "electron/build-windows.sh", hosts: ["win32"] },
  download: { script: "scripts/make-download.sh", hosts: ["darwin", "linux", "win32"] },
};

const target = process.argv[2];
if (!target || !(target in TARGETS)) {
  console.error(`Usage: node scripts/build-desktop.mjs <${Object.keys(TARGETS).join("|")}>`);
  process.exit(2);
}

const { script, hosts } = TARGETS[target];
if (!hosts.includes(process.platform)) {
  console.error(`The "${target}" package must be built on ${hosts.join(" or ")}; this machine is ${process.platform}.`);
  process.exit(1);
}

function findBash() {
  if (process.platform !== "win32") return "bash";

  const gitBash = [
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, "Git", "bin", "bash.exe"),
    process.env["ProgramFiles(x86)"] && path.join(process.env["ProgramFiles(x86)"], "Git", "bin", "bash.exe"),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Programs", "Git", "bin", "bash.exe"),
  ].find((candidate) => candidate && existsSync(candidate));

  if (!gitBash) {
    console.error("Windows packages run through Git Bash. Install Git for Windows: https://git-scm.com/download/win");
    process.exit(1);
  }
  return gitBash;
}

const bash = findBash();
const result = spawnSync(bash, [script], { cwd: root, stdio: "inherit", env: process.env });

if (result.error) {
  console.error(`Could not start ${bash}: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
