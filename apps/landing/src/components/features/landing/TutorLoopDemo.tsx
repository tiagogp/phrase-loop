"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { translateLanding } from "@landing/lib/landingLanguage";
import type { LandingLanguage } from "@landing/types/landing";

/** Scripted illustration: no learner score, clock manipulation, or provider call. */
export function TutorLoopDemo({ language }: { language: LandingLanguage }) {
  const [step, setStep] = useState(0);
  const t = (text: string) => translateLanding(language, text);
  return <Card className="mx-auto max-w-2xl space-y-5 p-6 sm:p-8">
    <p className="text-xs text-ink-muted">{t("Exemplo ilustrativo · não avalia seu inglês")}</p>
    <h2 className="text-2xl font-semibold text-ink">{t(["Sua próxima prática", "Experiência que continua no presente", "Acerto com apoio", "Outro dia · outra situação"][step])}</h2>
    {step === 0 && <><p className="text-ink-soft">{t("Conte sua experiência em uma entrevista.")}</p><div className="rounded border border-line p-4"><p className="mb-2 text-xs text-ink-muted">{t("Tentativa de exemplo")}</p><p lang="en">I have five years working with React.</p></div></>}
    {step === 1 && <p className="leading-relaxed text-ink-soft">{t("Para uma experiência ainda em andamento, uma forma possível é “I have been working…” com “for” e a duração.")}</p>}
    {step === 2 && <><blockquote lang="en" className="border-l-2 border-accent pl-4">I have been working with React for five years.</blockquote><p className="text-ink-soft">{t("A resposta foi reconstruída após feedback. Ainda falta observar uso independente em outro dia.")}</p></>}
    {step === 3 && <><p className="text-ink">{t("Um colega novo quer saber há quanto tempo você trabalha remotamente. Responda antes de consultar exemplos.")}</p><p className="text-sm text-ink-muted">{t("No app, uma resposta independente pode gerar evidência de transferência. Esta demonstração apenas ilustra o percurso.")}</p></>}
    <Button onClick={() => setStep((step + 1) % 4)}>{t(["Ver feedback do exemplo", "Ver nova tentativa do exemplo", "Ver retomada em outro dia", "Recomeçar exemplo"][step])}</Button>
  </Card>;
}
