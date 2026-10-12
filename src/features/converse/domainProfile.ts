/**
 * Domain profiles: bundled scenarios for the long session, starting with software development.
 * A profile names what the learner has to do with the language in each scenario (`functions`) and
 * some expressions a professional would use there. Expressions are model-generated and stay
 * `reviewed: false` until the product owner reviews them; nothing here claims they are verified.
 */

import softwareDev from "./domainProfiles/software-dev.json";
import type { LongSessionTopic } from "./longSession";

export const DOMAIN_AREAS = ["software-dev"] as const;
export type DomainArea = (typeof DOMAIN_AREAS)[number];

interface Localized {
  pt: string;
  en: string;
}

export interface DomainExpression {
  text: string;
  functionId: string;
  register: "casual" | "neutral";
  note: string;
  reviewed: boolean;
}

export interface DomainScenario {
  id: string;
  label: Localized;
  situation: Localized;
  aiRole: string;
  functions: { id: string; label: Localized }[];
  expressions: DomainExpression[];
}

export interface DomainProfile {
  id: DomainArea;
  version: number;
  label: Localized;
  provenance: string;
  scenarios: DomainScenario[];
}

function isLocalized(value: unknown): value is Localized {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.pt === "string" && v.pt.trim().length > 0 && typeof v.en === "string" && v.en.trim().length > 0;
}

/** Structural check for a bundled profile. Returns every problem found; empty means valid. */
export function validateDomainProfile(raw: unknown): string[] {
  const errors: string[] = [];
  if (typeof raw !== "object" || raw === null) return ["Profile must be an object."];
  const profile = raw as Record<string, unknown>;
  if (!DOMAIN_AREAS.includes(profile.id as DomainArea)) errors.push(`Unknown profile id: ${String(profile.id)}.`);
  if (!isLocalized(profile.label)) errors.push("Profile label needs pt and en.");
  if (!Array.isArray(profile.scenarios) || profile.scenarios.length === 0) return [...errors, "Profile needs scenarios."];
  const scenarioIds = new Set<string>();
  profile.scenarios.forEach((item, index) => {
    const at = `scenarios[${index}]`;
    if (typeof item !== "object" || item === null) {
      errors.push(`${at} must be an object.`);
      return;
    }
    const scenario = item as Record<string, unknown>;
    const id = typeof scenario.id === "string" ? scenario.id : "";
    if (!/^[a-z0-9-]+$/.test(id)) errors.push(`${at} needs a kebab-case id.`);
    if (scenarioIds.has(id)) errors.push(`${at} repeats id ${id}.`);
    scenarioIds.add(id);
    if (!isLocalized(scenario.label)) errors.push(`${at}.label needs pt and en.`);
    if (!isLocalized(scenario.situation)) errors.push(`${at}.situation needs pt and en.`);
    if (typeof scenario.aiRole !== "string" || !scenario.aiRole.trim()) errors.push(`${at}.aiRole is required.`);
    const functionIds = new Set<string>();
    if (!Array.isArray(scenario.functions) || scenario.functions.length === 0) errors.push(`${at} needs functions.`);
    else scenario.functions.forEach((fn, fnIndex) => {
      const f = fn as Record<string, unknown>;
      if (typeof f?.id !== "string" || !/^[a-z0-9-]+$/.test(f.id)) errors.push(`${at}.functions[${fnIndex}] needs a kebab-case id.`);
      else if (functionIds.has(f.id)) errors.push(`${at}.functions[${fnIndex}] repeats id ${f.id}.`);
      else functionIds.add(f.id);
      if (!isLocalized(f?.label)) errors.push(`${at}.functions[${fnIndex}].label needs pt and en.`);
    });
    if (!Array.isArray(scenario.expressions) || scenario.expressions.length === 0) errors.push(`${at} needs expressions.`);
    else scenario.expressions.forEach((ex, exIndex) => {
      const e = ex as Record<string, unknown>;
      const where = `${at}.expressions[${exIndex}]`;
      if (typeof e?.text !== "string" || !e.text.trim()) errors.push(`${where} needs text.`);
      if (typeof e?.functionId !== "string" || !functionIds.has(e.functionId)) errors.push(`${where} points to an unknown function.`);
      if (e?.register !== "casual" && e?.register !== "neutral") errors.push(`${where} register must be casual or neutral.`);
      if (typeof e?.note !== "string" || !e.note.trim()) errors.push(`${where} needs a note.`);
      if (typeof e?.reviewed !== "boolean") errors.push(`${where} must say whether it was reviewed.`);
    });
  });
  return errors;
}

const PROFILES: Record<DomainArea, DomainProfile> = {
  "software-dev": softwareDev as DomainProfile,
};

export function isDomainArea(value: unknown): value is DomainArea {
  return DOMAIN_AREAS.includes(value as DomainArea);
}

export function domainProfile(area: DomainArea): DomainProfile {
  return PROFILES[area];
}

/**
 * Setup topics for a learner. Labels and situations follow the interface language; the prompt
 * always receives the English function labels and the English situation.
 */
export function profileTopics(area: DomainArea, lang: "pt" | "en"): LongSessionTopic[] {
  const profile = domainProfile(area);
  return profile.scenarios.map((scenario) => ({
    id: scenario.id,
    profileId: profile.id,
    label: scenario.label[lang],
    situation: scenario.situation.en,
    displaySituation: scenario.situation[lang],
    aiRole: scenario.aiRole,
    functions: scenario.functions.map((fn) => ({ id: fn.id, label: fn.label.en, displayLabel: fn.label[lang] })),
    expressions: scenario.expressions.map((expression) => expression.text),
  }));
}
