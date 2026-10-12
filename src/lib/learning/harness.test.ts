import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { tutorScenarioFor } from "@/features/tutor/catalog";
import { isTutorFeedback, isTutorSession } from "@/features/tutor/contract";
import { hasTutorDiagnosis, tutorSkillEvidence } from "@/features/tutor/learning";
import { nextTutorReview, tutorProduction } from "@/features/tutor/model";
import { DAY, durationHistory, tutorAttempt, tutorSession } from "@/features/tutor/testFixtures";
import type { TutorAttempt, TutorExposure, TutorSession } from "@/features/tutor/types";
import { LEARNING_PRINCIPLES } from "./principles";

/**
 * Harness de aprendizagem: cada teste começa com o ID do princípio entre colchetes
 * (ver principles.ts e docs/learning.md) e roda o código real do app sobre históricos
 * simulados de aluno. `yarn learning:harness` agrupa os resultados por princípio.
 */
const evidenceOf = (sessions: TutorSession[]) => tutorSkillEvidence(sessions, sessions[0].skill!);
const skill = durationHistory()[0].skill!;
const demonstrated = { label: skill.label, conceptId: skill.conceptId, evidence: "", result: "demonstrated" as const };
const needsWork = (quote: string): TutorAttempt["feedback"] => ({
  ...tutorAttempt().feedback, status: "partial", skill: { ...demonstrated, result: "needs_work", evidence: quote },
  points: [{ original: quote, revised: "I have been working for five years", explanation: "Experiência que continua." }],
});

/** Sessão de retomada, num contexto verificado, `at` ms depois do início do histórico. */
function revisit(id: string, scenarioId: string, at: number, attempt: Partial<TutorAttempt> = {}): TutorSession {
  return tutorSession({ id, skill: { ...skill }, task: tutorScenarioFor(scenarioId), phase: "complete", createdAt: at, updatedAt: at + 100, completedAt: at + 100,
    attempts: [tutorAttempt({ id: `${id}-answer`, text: "I've been living here for ten years and I really enjoy it.", createdAt: at, feedback: { ...tutorAttempt().feedback, skill: demonstrated }, ...attempt })],
    exposures: [{ id: `${id}-feedback`, kind: "feedback", at: at + 50 }] });
}

describe("harness de aprendizagem", () => {
  it("[registro] todo princípio tem regra, fonte e medida com pessoas", () => {
    const ids = LEARNING_PRINCIPLES.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of LEARNING_PRINCIPLES) {
      expect(p.sources.length, p.id).toBeGreaterThan(0);
      expect(p.rule.trim(), p.id).not.toBe("");
      expect(p.outcome.trim(), p.id).not.toBe("");
    }
  });

  describe("P1 recuperação antes da exposição", () => {
    it("[P1] responder 1h depois de ver feedback é acerto com apoio, não independente", () => {
      const [origin] = durationHistory();
      const soon = revisit("soon", "duration-city-v1", 3500 + 3_600_000);
      expect(evidenceOf([origin, soon])).toMatchObject({ independent: 0, transfers: 0 });
      expect(evidenceOf([origin, soon]).supportedAttemptIds).toContain("soon-answer");
    });

    it("[P1] a mesma resposta 24h depois da última exposição, sem apoio, é independente", () => {
      const [origin] = durationHistory();
      const later = revisit("later", "duration-city-v1", 3500 + DAY);
      expect(evidenceOf([origin, later])).toMatchObject({ independent: 1 });
    });

    it("[P1] marcar apoio na tentativa anula o crédito de independência", () => {
      const [origin] = durationHistory();
      const helped = revisit("helped", "duration-city-v1", 3 * DAY, { supportUsed: true });
      expect(evidenceOf([origin, helped])).toMatchObject({ independent: 0, transfers: 0 });
    });
  });

  describe("P2 espaçamento", () => {
    it("[P2] em históricos gerados, a retomada nunca ocorre antes de 24h da última exposição", () => {
      let seed = 42;
      const random = () => (seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31;
      const scenarios = ["duration-interview-v1", "duration-remote-v1", "duration-learning-v1", "duration-city-v1"];
      for (let run = 0; run < 200; run++) {
        let clock = 1000;
        const sessions: TutorSession[] = [];
        for (let i = 0; i < 1 + Math.floor(random() * 4); i++) {
          clock += Math.floor(random() * 3 * DAY);
          const attempts = Array.from({ length: 1 + Math.floor(random() * 3) }, (_, n) => tutorAttempt({
            id: `r${run}s${i}a${n}`, createdAt: clock + n * 1000, supportUsed: random() < 0.3,
            feedback: random() < 0.4 ? needsWork("I have five years") : { ...tutorAttempt().feedback, skill: demonstrated },
            text: random() < 0.4 ? "I have five years working with React." : `I've worked here for ${n + 2} years.`,
          }));
          const exposures: TutorExposure[] = attempts.map(a => ({ id: `${a.id}-fb`, kind: "feedback", at: a.createdAt + Math.floor(random() * DAY) }));
          if (random() < 0.3) exposures.push({ id: `r${run}s${i}-hist`, kind: "history", at: clock + Math.floor(random() * 2 * DAY) });
          sessions.push(tutorSession({ id: `r${run}s${i}`, skill: { ...skill }, task: tutorScenarioFor(scenarios[Math.floor(random() * 4)]),
            phase: "complete", createdAt: clock, updatedAt: clock + 5000, completedAt: clock + 5000, attempts, exposures }));
        }
        const last = sessions.at(-1)!;
        const now = last.completedAt!;
        const next = nextTutorReview(last, now, sessions.slice(0, -1))!;
        const lastExposure = Math.max(...sessions.flatMap(s => s.exposures!.map(e => e.at)));
        expect(next - now).toBeGreaterThanOrEqual(DAY);
        expect(next - lastExposure).toBeGreaterThanOrEqual(DAY);
      }
    });

    it("[P2] o intervalo cresce com a evidência: apoio 1 dia, transferência 7 dias", () => {
      const [origin, followup] = durationHistory();
      const now = 10 * DAY;
      expect(nextTutorReview(origin, now, [])).toBe(now + DAY);
      expect(evidenceOf([origin, followup]).state).toBe("transfer_observed");
      expect(nextTutorReview(followup, now, [origin])).toBe(now + 7 * DAY);
    });

    it("[P2] evidência consistente em dias separados espaça para 14 dias", () => {
      const [origin, followup] = durationHistory();
      followup.attempts[0].createdAt = 2 * DAY;
      followup.exposures = [{ id: "fb", kind: "feedback", at: 2 * DAY + 50 }];
      const third = revisit("third", "duration-learning-v1", 4 * DAY, { text: "I've been studying Rust for six months at night." });
      expect(evidenceOf([origin, followup, third]).state).toBe("consistent");
      expect(nextTutorReview(third, 10 * DAY, [origin, followup])).toBe(24 * DAY);
    });
  });

  describe("P3 feedback focal e reconstrução", () => {
    it("[P3] o contrato rejeita feedback com mais de dois ajustes", () => {
      const point = { original: "a", revised: "b", explanation: "c" };
      expect(isTutorFeedback({ ...tutorAttempt().feedback, points: [point, point] })).toBe(true);
      expect(isTutorFeedback({ ...tutorAttempt().feedback, points: [point, point, point] })).toBe(false);
    });

    it("[P3] uma sessão aceita no máximo três tentativas", () => {
      const attempts = ["a", "b", "c", "d"].map((id, n) => tutorAttempt({ id, createdAt: 2000 + n }));
      expect(isTutorSession(tutorSession({ attempts: attempts.slice(0, 3), phase: "complete" }))).toBe(true);
      expect(isTutorSession(tutorSession({ attempts, phase: "complete" }))).toBe(false);
    });

    it("[P3] retry com o mesmo texto não conta como melhora", () => {
      const [origin] = durationHistory();
      origin.attempts[1] = { ...origin.attempts[1], text: "I have five years working with React." };
      expect(evidenceOf([origin]).improvements).toBe(0);
      expect(evidenceOf(durationHistory()).improvements).toBe(1);
    });
  });

  describe("P4 transferência", () => {
    it("[P4] contexto novo, verificado, 24h depois da dificuldade e sem apoio conta como transferência", () => {
      expect(evidenceOf(durationHistory())).toMatchObject({ transfers: 1, contexts: 1 });
    });

    it("[P4] repetir o contexto de origem dias depois é recuperação, não transferência", () => {
      const [origin] = durationHistory();
      const same = revisit("same", "duration-interview-v1", 3 * DAY);
      expect(evidenceOf([origin, same])).toMatchObject({ independent: 1, transfers: 0 });
    });

    it("[P4] contexto novo antes de 24h da dificuldade não é transferência", () => {
      const [origin] = durationHistory();
      origin.exposures = [];
      const early = revisit("early", "duration-city-v1", 2000 + DAY - 1);
      expect(evidenceOf([origin, early]).transfers).toBe(0);
    });

    it("[P4] copiar o exemplo mostrado antes não é transferência", () => {
      const [origin] = durationHistory();
      const copy = revisit("copy", "duration-city-v1", 3 * DAY, { text: "I have been working with React for five years." });
      expect(evidenceOf([origin, copy])).toMatchObject({ independent: 1, transfers: 0 });
    });
  });

  describe("P5 sensação de aprender não é evidência", () => {
    it("[P5] a prática do tutor entra nas métricas gerais como não avaliada", () => {
      const [origin] = durationHistory();
      expect(origin.attempts.map(a => tutorProduction(origin, a).evaluated)).toEqual([false, false]);
    });

    it("[P5] avaliação incerta não vira acerto, mesmo com habilidade marcada como demonstrada", () => {
      const [origin] = durationHistory();
      const unsure = revisit("unsure", "duration-city-v1", 3 * DAY);
      unsure.attempts[0].feedback = { ...unsure.attempts[0].feedback, status: "uncertain" };
      expect(evidenceOf([origin, unsure])).toMatchObject({ independent: 0, transfers: 0, state: "developing" });
    });

    it("[P5] avaliação contestada sai da evidência", () => {
      const [origin, followup] = durationHistory();
      followup.attempts[0].disputed = true;
      expect(evidenceOf([origin, followup])).toMatchObject({ transfers: 0, independent: 0 });
    });
  });

  describe("P6 lacuna com prova", () => {
    it("[P6] dificuldade só vale com trecho literal da resposta ligado a um ajuste", () => {
      const quoted = tutorAttempt({ text: "I have five years working with React.", feedback: needsWork("I have five years") });
      expect(hasTutorDiagnosis(quoted)).toBe(true);
      expect(hasTutorDiagnosis({ ...quoted, feedback: needsWork("I has five year") })).toBe(false);
      expect(hasTutorDiagnosis({ ...quoted, feedback: { ...needsWork("I have five years"), points: [] } })).toBe(false);
    });
  });

  describe("P7 IA como muleta", () => {
    it("[P7] perguntar ao tutor antes de responder torna a resposta assistida", () => {
      const [origin] = durationHistory();
      const asked = revisit("asked", "duration-city-v1", 3 * DAY);
      asked.help = [{ question: "How do I say há dez anos?", answer: "for ten years", createdAt: 3 * DAY - 60_000 }];
      expect(evidenceOf([origin, asked])).toMatchObject({ independent: 0, transfers: 0 });
    });
  });

  describe("P11 sem pressão de jogo", () => {
    it("[P11] nenhuma tela renderiza XP, sequência, ranking ou conquistas", () => {
      const root = path.resolve(__dirname, "../..");
      const files = (readdirSync(root, { recursive: true }) as string[]).filter(f => f.endsWith(".tsx") && !f.includes(".test."));
      // `achievement` em TutorPractice é a frase "agora você consegue", sustentada por avaliação válida.
      const pattern = /\bXP\b|streak|leaderboard/i;
      const offenders = files.filter(f => pattern.test(readFileSync(path.join(root, f), "utf8")));
      expect(offenders).toEqual([]);
    });
  });
});
