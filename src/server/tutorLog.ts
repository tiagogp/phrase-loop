import "server-only";

import { appendFileSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dataDir } from "@/server/native/data";

const MAX_BYTES = 5 * 1024 * 1024;

export function tutorLogPath(): string {
  return path.join(dataDir(), "logs", "tutor-debug.jsonl");
}

/** Append one diagnostic line per tutor step; the packaged app has no visible server console. Never throws. */
export function logTutor(entry: Record<string, unknown>): void {
  const line = JSON.stringify({ at: new Date().toISOString(), ...entry });
  console.error(`[tutor] ${line}`);
  if (process.env.VITEST) return;
  try {
    const file = tutorLogPath();
    mkdirSync(path.dirname(file), { recursive: true });
    try { if (statSync(file).size > MAX_BYTES) writeFileSync(file, ""); } catch { /* first write */ }
    appendFileSync(file, `${line}\n`);
  } catch { /* logging must not break the request */ }
}
