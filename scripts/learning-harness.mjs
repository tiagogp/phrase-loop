import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const HARNESS = "src/lib/learning/harness.test.ts";
const strengthLabel = { strong: "forte", moderate: "moderada", limited: "limitada", product: "decisão de produto" };

/** Groups harness assertions by the `[P#]` tag at the start of each test title. */
export function harnessReport(principles, assertions) {
  const tagged = assertions.map(a => ({ ...a, tag: /^\[([A-Za-z0-9-]+)\]/.exec(a.title)?.[1] }));
  const rows = principles.map(p => {
    const own = tagged.filter(a => a.tag === p.id);
    const passed = own.filter(a => a.status === "passed").length;
    const failed = own.filter(a => a.status !== "passed").length;
    return { id: p.id, title: p.title, strength: p.strength, passed, failed, planned: p.planned.length, outcome: p.outcome,
      status: failed ? "falhou" : passed ? "regra verificada no app" : "sem verificação automática" };
  });
  const known = new Set([...principles.map(p => p.id), "registro"]);
  return { rows, untagged: tagged.filter(a => !a.tag).map(a => a.title), unknown: tagged.filter(a => a.tag && !known.has(a.tag)).map(a => a.title),
    failed: tagged.filter(a => a.status !== "passed").map(a => a.title) };
}

export function formatReport(report) {
  const lines = [
    "| Princípio | Evidência | Verificações | Planejadas | Situação |",
    "| --- | --- | --- | --- | --- |",
    ...report.rows.map(r => `| ${r.id} ${r.title} | ${strengthLabel[r.strength]} | ${r.passed}/${r.passed + r.failed} | ${r.planned} | ${r.status} |`),
    "",
    "A suíte mostra que o app aplica as regras. Se elas fazem a pessoa aprender, só se mede com pessoas:",
    ...report.rows.map(r => `- ${r.id}: ${r.outcome}`),
  ];
  if (report.failed.length) lines.push("", "Falhas:", ...report.failed.map(t => `- ${t}`));
  if (report.unknown.length) lines.push("", "Testes com princípio desconhecido:", ...report.unknown.map(t => `- ${t}`));
  if (report.untagged.length) lines.push("", "Testes sem princípio:", ...report.untagged.map(t => `- ${t}`));
  return lines.join("\n");
}

function loadPrinciples() {
  const file = path.join(root, "src/lib/learning/principles.ts");
  const js = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loaded = { exports: {} };
  new Function("module", "exports", js)(loaded, loaded.exports);
  return loaded.exports.LEARNING_PRINCIPLES;
}

function runHarness() {
  const output = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "learning-harness-")), "result.json");
  const vitest = path.join(root, "node_modules/vitest/vitest.mjs");
  const run = spawnSync(process.execPath, [vitest, "run", HARNESS, "--reporter=json", `--outputFile=${output}`], { cwd: root, encoding: "utf8" });
  if (!fs.existsSync(output)) throw new Error(`Vitest não gerou resultado.\n${run.stderr || run.stdout}`);
  const result = JSON.parse(fs.readFileSync(output, "utf8"));
  return result.testResults.flatMap(file => file.assertionResults.map(a => ({ title: a.title, status: a.status })));
}

async function main() {
  const { values } = parseArgs({ options: { json: { type: "string" } } });
  const report = harnessReport(loadPrinciples(), runHarness());
  console.log(formatReport(report));
  if (values.json) fs.writeFileSync(values.json, `${JSON.stringify({ generatedAt: new Date().toISOString(), ...report }, null, 2)}\n`);
  if (report.failed.length || report.unknown.length) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
