import { expect, it } from "vitest";
import { formatReport, harnessReport } from "./learning-harness.mjs";

const principles = [
  { id: "P1", title: "Recuperar", strength: "strong", outcome: "D7 sem apoio", planned: [] },
  { id: "P2", title: "Espaçar", strength: "moderate", outcome: "D30", planned: ["conversa"] },
  { id: "P3", title: "Blocos", strength: "limited", outcome: "uso espontâneo", planned: [] },
];

it("groups assertions by principle tag and separates unverified principles", () => {
  const report = harnessReport(principles, [
    { title: "[P1] antes de ver", status: "passed" },
    { title: "[P1] depois de 24h", status: "passed" },
    { title: "[P2] nunca antes de 24h", status: "failed" },
    { title: "[registro] completo", status: "passed" },
  ]);
  expect(report.rows.map(r => [r.id, r.passed, r.failed, r.status])).toEqual([
    ["P1", 2, 0, "regra verificada no app"], ["P2", 0, 1, "falhou"], ["P3", 0, 0, "sem verificação automática"],
  ]);
  expect(report).toMatchObject({ failed: ["[P2] nunca antes de 24h"], unknown: [], untagged: [] });
  expect(formatReport(report)).toContain("| P2 Espaçar | moderada | 0/1 | 1 | falhou |");
});

it("flags tests whose tag is missing from the registry", () => {
  const report = harnessReport(principles, [{ title: "[P9] sem registro", status: "passed" }, { title: "sem tag", status: "passed" }]);
  expect(report).toMatchObject({ unknown: ["[P9] sem registro"], untagged: ["sem tag"] });
});
