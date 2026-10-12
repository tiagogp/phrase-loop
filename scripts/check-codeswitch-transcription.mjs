import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

/** Whisper modes compared side by side: auto-detection, forced Portuguese, forced English. */
export const MODES = ["auto", "pt", "en"];
const AUDIO_EXTENSIONS = new Set([".webm", ".wav", ".mp3", ".m4a", ".ogg", ".mp4", ".flac"]);
const MIME = { ".webm": "audio/webm", ".wav": "audio/wav", ".mp3": "audio/mpeg", ".m4a": "audio/mp4",
  ".ogg": "audio/ogg", ".mp4": "audio/mp4", ".flac": "audio/flac" };

export function audioFilesIn(names) {
  return names.filter(name => AUDIO_EXTENSIONS.has(path.extname(name).toLowerCase())).sort();
}

/** One request per mode through the app's own /api/transcribe, so the forced-language path is the real one. */
export async function transcribeModes(file, bytes, { baseUrl, fetchImpl = fetch }) {
  const results = {};
  for (const mode of MODES) {
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream" }), file);
    if (mode !== "auto") form.append("language", mode);
    try {
      const response = await fetchImpl(new URL("/api/transcribe", baseUrl), { method: "POST", body: form });
      const data = await response.json().catch(() => ({}));
      results[mode] = response.ok ? { text: (data.text ?? "").trim() } : { error: data.error ?? `HTTP ${response.status}` };
    } catch (error) {
      results[mode] = { error: error instanceof Error ? error.message : "request failed" };
    }
  }
  return results;
}

const cell = value => (value.error ? `⚠ ${value.error}` : value.text || "(vazio)").replace(/\|/g, "\\|").replace(/\s+/g, " ");

export function renderMarkdown(report) {
  const lines = [
    "# Transcrição com troca de idioma",
    "",
    `Gerado em ${report.generatedAt} a partir de ${report.files.length} arquivo(s). Resultado para o responsável conferir;`,
    "passa se o trecho gravado com o botão sai em português correto no modo `pt`. O modo automático é só medido.",
    "",
    "| Arquivo | auto | pt | en |",
    "| --- | --- | --- | --- |",
    ...report.files.map(row => `| ${row.file} | ${MODES.map(mode => cell(row.modes[mode])).join(" | ")} |`),
    "",
  ];
  return lines.join("\n");
}

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    "base-url": { type: "string", default: "http://localhost:3000" },
    output: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  } });
  const dir = positionals[0];
  if (!dir) throw new Error("Usage: node scripts/check-codeswitch-transcription.mjs <audio-folder> [--base-url URL] [--output file.md|file.json] [--dry-run]");
  const files = audioFilesIn(await readdir(dir));
  if (!files.length) throw new Error(`No audio files in ${dir}.`);
  const rows = [];
  for (const file of files) {
    rows.push({ file, modes: values["dry-run"]
      ? Object.fromEntries(MODES.map(mode => [mode, { text: "(dry-run: não transcrito)" }]))
      : await transcribeModes(file, await readFile(path.join(dir, file)), { baseUrl: values["base-url"] }) });
  }
  const report = { mode: values["dry-run"] ? "dry_run" : "transcribed", baseUrl: values["base-url"], generatedAt: new Date().toISOString(), files: rows };
  const output = values.output || `codeswitch-transcription-${report.generatedAt.replace(/[:.]/g, "-")}.md`;
  await writeFile(output, output.endsWith(".json") ? JSON.stringify(report, null, 2) + "\n" : renderMarkdown(report));
  console.log(`${report.mode}: ${files.length} file(s) × ${MODES.length} modes. Report: ${output}. Recordings stay local; the pass/fail call is the product owner's.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    console.error("Is the app running? Start it with `yarn dev` and pass --base-url if it is not on port 3000.");
    process.exitCode = 1;
  });
}
