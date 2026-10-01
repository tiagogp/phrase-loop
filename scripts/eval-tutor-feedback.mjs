import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
import { loadTutorRuntime } from "./tutor-runtime.mjs";

export function agreementReport(rows) {
  const group = key => Object.fromEntries([...new Set(rows.map(r => r[key]))].map(value => {
    const members = rows.filter(r => r[key] === value);
    const matches = members.filter(r => r.agrees).length;
    return [value, { cases: members.length, matches, agreement: matches / members.length }];
  }));
  return { cases: rows.length, matches: rows.filter(r => r.agrees).length, invalid: rows.filter(r => r.invalid).length,
    byStatus: group("expectedStatus"), bySkill: group("conceptId") };
}

export async function evaluateCases(cases, { runtime, provider, complete }) {
  const rows = [];
  for (const item of cases) {
    const task = runtime.tutorScenarioFor(item.scenarioId);
    const request = { action: "evaluate", provider, context: { level: "A2", minutes: 5, explanationLanguage: "pt", focus: task.goal,
      evidence: [], targetConceptId: item.conceptId, targetSkill: runtime.TUTOR_CONCEPTS[item.conceptId].label }, task, text: item.text };
    let actual;
    let invalid = false;
    try {
      actual = runtime.extractJsonObject(await complete(runtime.buildTutorPrompt(request)));
      invalid = !runtime.isTutorFeedback(actual) || actual.skill?.conceptId !== item.conceptId
        || actual.points.some(p => !item.text.includes(p.original))
        || (actual.skill.result === "needs_work" && (!actual.skill.evidence?.trim() || !item.text.includes(actual.skill.evidence)
          || !actual.points.some(p => p.original.includes(actual.skill.evidence) || actual.skill.evidence.includes(p.original))));
    } catch { invalid = true; }
    rows.push({ id: item.id, kind: item.kind, conceptId: item.conceptId, expectedStatus: item.expected.status,
      expectedResult: item.expected.result, actualStatus: actual?.status ?? null, actualResult: actual?.skill?.result ?? null,
      invalid, agrees: !invalid && actual.status === item.expected.status && actual.skill.result === item.expected.result });
  }
  return rows;
}

async function main() {
  const { values } = parseArgs({ options: { provider: { type: "string", default: "ollama" }, output: { type: "string" }, "dry-run": { type: "boolean", default: false } } });
  if (!["ollama", "openai", "claude", "openrouter"].includes(values.provider)) throw new Error("Unknown provider.");
  const cases = JSON.parse(await readFile(new URL("./content/tutor-feedback-cases.json", import.meta.url), "utf8"));
  const runtime = loadTutorRuntime();
  let report;
  if (values["dry-run"]) {
    for (const item of cases) {
      if (runtime.verifiedTutorContext(runtime.tutorScenarioFor(item.scenarioId), item.conceptId) === undefined) throw new Error("Unverified evaluation case.");
    }
    report = { mode: "dry_run", cases: cases.length, skills: [...new Set(cases.map(c => c.conceptId))], agreement: null };
  } else {
    loadEnvConfig(fileURLToPath(new URL("../", import.meta.url)), false, { info() {}, error() {} });
    if (!await runtime.isProviderAvailable(values.provider)) throw new Error("Provider unavailable or not configured. Configure it before running; no calls were made.");
    const provider = runtime.resolveProvider(values.provider);
    if (!provider.complete) throw new Error("Provider does not support feedback evaluation.");
    const rows = await evaluateCases(cases, { runtime, provider: values.provider, complete: prompt => provider.complete(prompt, { timeoutMs: 120_000 }) });
    report = { mode: "provider_run", provider: values.provider, model: provider.modelId, promptVersion: runtime.TUTOR_PROMPT_VERSION,
      ...agreementReport(rows), rows };
  }
  const output = values.output || `tutor-feedback-report-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  await writeFile(output, JSON.stringify({ ...report, expectedCasesReview: "pending_human_review", generatedAt: new Date().toISOString() }, null, 2) + "\n");
  console.log(`${report.mode}: ${cases.length} cases. Report: ${output}. Expected cases need human review; this is not proof of calibration.`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch(() => { console.error("Evaluation could not finish. Check the provider configuration and output path. No calibration is claimed."); process.exitCode = 1; });
