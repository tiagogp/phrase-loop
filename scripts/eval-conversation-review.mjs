import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
import { loadRepoModules } from "./tutor-runtime.mjs";

const PROVIDERS = ["ollama", "openai", "claude", "openrouter"];

/** "ollama:gemma4:27b" → { provider: "ollama", model: "gemma4:27b" }; cloud providers take no model. */
export function parseSide(value) {
  const [provider, ...rest] = String(value ?? "").split(":");
  if (!PROVIDERS.includes(provider)) throw new Error(`Unknown provider: ${provider}. Use one of ${PROVIDERS.join(", ")}.`);
  const model = rest.join(":") || undefined;
  return { provider, model: provider === "ollama" ? model : undefined, label: provider === "ollama" && model ? `ollama:${model}` : provider };
}

/** Long sessions with learner turns, from a PhraseLoop backup file or a plain array of conversations. */
export function longSessionsFrom(raw) {
  const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.stores?.conversations) ? raw.stores.conversations : [];
  return rows.filter(c => c?.mode === "long" && Array.isArray(c.turns) && c.turns.some(t => t.role === "user" && t.text?.trim()));
}

function reviewInput(conversation, knownPatternLabels) {
  return { turns: conversation.turns, level: conversation.level, scenario: conversation.scenario, functions: [], knownPatternLabels };
}

/** Same prompt and parser as the app; each side reviews every session once. */
export async function compareReviews(sessions, { runtime, sides, completeFor, knownPatternLabels = [] }) {
  const rows = [];
  for (const conversation of sessions) {
    const input = reviewInput(conversation, knownPatternLabels);
    const prompt = runtime.buildGapReviewPrompt(input);
    const results = {};
    for (const side of sides) {
      try {
        const review = runtime.parseGapReview(await completeFor(side)(prompt), input);
        results[side.label] = { malformed: Boolean(review.malformed), strengths: review.strengths,
          gaps: review.gaps.map(g => ({ kind: g.kind, evidence: g.evidence, natural: g.natural.neutral, patternLabel: g.patternLabel, functionId: g.functionId ?? null })) };
      } catch (error) {
        results[side.label] = { error: error instanceof Error ? error.message : "call failed", gaps: [], strengths: [] };
      }
    }
    rows.push({ sessionId: conversation.id, scenario: conversation.longSession?.label ?? conversation.context, startedAt: conversation.startedAt,
      learnerTurns: conversation.turns.filter(t => t.role === "user").length, results });
  }
  return rows;
}

const cell = value => String(value ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ");

export function renderComparison(report) {
  const labels = report.sides;
  const lines = [
    "# Revisão da sessão longa: comparação de modelos",
    "",
    `Gerado em ${report.generatedAt}. ${report.sessions.length} sessão(ões). Prompt ${report.promptVersion}.`,
    "Para o responsável comparar. Nenhum modelo é declarado calibrado; o arquivo contém falas do aluno e fica no computador.",
    "",
  ];
  for (const row of report.sessions) {
    lines.push(`## ${cell(row.scenario)} · ${new Date(row.startedAt).toISOString().slice(0, 10)} · ${row.learnerTurns} falas`, "");
    lines.push(`| | ${labels.map(cell).join(" | ")} |`, `| --- | ${labels.map(() => "---").join(" | ")} |`);
    const max = Math.max(1, ...labels.map(label => row.results[label]?.gaps.length ?? 0));
    for (let index = 0; index < max; index += 1) {
      lines.push(`| Lacuna ${index + 1} | ${labels.map(label => {
        const result = row.results[label];
        if (result?.error) return index === 0 ? `⚠ ${cell(result.error)}` : "";
        if (result?.malformed) return index === 0 ? "⚠ resposta malformada" : "";
        const gap = result?.gaps[index];
        return gap ? `**${cell(gap.patternLabel)}** (${gap.kind}): “${cell(gap.evidence)}” → ${cell(gap.natural)}` : "";
      }).join(" | ")} |`);
    }
    lines.push(`| Pontos fortes | ${labels.map(label => cell((row.results[label]?.strengths ?? []).join("; "))).join(" | ")} |`, "");
  }
  return lines.join("\n");
}

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    a: { type: "string", default: "ollama" }, b: { type: "string" }, output: { type: "string" },
    limit: { type: "string", default: "10" }, "dry-run": { type: "boolean", default: false },
  } });
  if (!positionals[0]) throw new Error("Usage: node scripts/eval-conversation-review.mjs <backup.json> --a ollama:qwen3.5:9b --b claude [--limit 10] [--output report.md] [--dry-run]");
  const sides = [parseSide(values.a), ...(values.b ? [parseSide(values.b)] : [])];
  const raw = JSON.parse(await readFile(positionals[0], "utf8"));
  const sessions = longSessionsFrom(raw).sort((x, y) => y.startedAt - x.startedAt).slice(0, Math.max(1, Number(values.limit) || 10));
  const knownPatternLabels = [...new Set((raw?.stores?.conversationGaps ?? []).map(g => g.patternLabel).filter(Boolean))];
  const runtime = loadRepoModules(["src/features/converse/gapReview.ts", "src/lib/cards/registry.ts"]);
  let rows;
  if (values["dry-run"]) {
    for (const session of sessions) runtime.buildGapReviewPrompt(reviewInput(session, knownPatternLabels));
    rows = sessions.map(c => ({ sessionId: c.id, scenario: c.longSession?.label ?? c.context, startedAt: c.startedAt,
      learnerTurns: c.turns.filter(t => t.role === "user").length,
      results: Object.fromEntries(sides.map(side => [side.label, { gaps: [], strengths: [], error: "dry-run: not reviewed" }])) }));
  } else {
    loadEnvConfig(fileURLToPath(new URL("../", import.meta.url)), false, { info() {}, error() {} });
    // Every side is checked before the first call, so an unconfigured paid provider costs nothing.
    for (const side of sides) {
      if (!await runtime.isProviderAvailable(side.provider)) throw new Error(`${side.label} is unavailable or not configured. No calls were made.`);
    }
    const providers = new Map(sides.map(side => [side.label, runtime.resolveProvider(side.provider, { model: side.model, learnerLang: "pt", targetLang: "en" })]));
    for (const [label, provider] of providers) if (!provider.complete) throw new Error(`${label} cannot run reviews. No calls were made.`);
    rows = await compareReviews(sessions, { runtime, sides, knownPatternLabels,
      completeFor: side => prompt => providers.get(side.label).complete(prompt, { timeoutMs: 120_000 }) });
  }
  const report = { mode: values["dry-run"] ? "dry_run" : "provider_run", promptVersion: runtime.GAP_REVIEW_PROMPT_VERSION,
    sides: sides.map(side => side.label), generatedAt: new Date().toISOString(), sessions: rows };
  const output = values.output || `conversation-review-${report.generatedAt.replace(/[:.]/g, "-")}.md`;
  await writeFile(output, output.endsWith(".json") ? JSON.stringify(report, null, 2) + "\n" : renderComparison(report));
  console.log(`${report.mode}: ${rows.length} long session(s) × ${sides.length} model(s). Report: ${output}. It contains learner turns; keep it local. No model is declared calibrated.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
