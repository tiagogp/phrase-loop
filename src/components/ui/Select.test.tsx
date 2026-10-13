import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { Field } from "./Field";
import Select from "./Select";

describe("shared select", () => {
  it("shows the complete selected label and associates its field and help text", () => {
    const label = "Falar sobre duração com present perfect e situações do trabalho";
    const { document } = parseHTML(renderToStaticMarkup(
      <Field label="Habilidade trabalhada" hint="Escolha a habilidade para esta sessão">
        <Select value="duration" onChange={() => {}} options={[{ value: "duration", label }]} />
      </Field>,
    ));
    const trigger = document.querySelector('[role="combobox"]')!;
    expect(trigger.textContent).toBe(label);
    expect(document.querySelector("label")?.getAttribute("for")).toBe(trigger.id);
    expect(document.getElementById(trigger.getAttribute("aria-describedby")!)?.textContent).toBe("Escolha a habilidade para esta sessão");
  });

  it("displays an empty-valued choice as a selection, not a blank placeholder", () => {
    const { document } = parseHTML(renderToStaticMarkup(
      <Select aria-label="Content" value="" onChange={() => {}}
        placeholder="Choose content" options={[{ value: "", label: "Suggested situation" }, { value: "option:", label: "Saved phrase" }]} />,
    ));
    const trigger = document.querySelector('[role="combobox"]')!;
    expect(trigger.textContent).toBe("Suggested situation");
    expect(trigger.hasAttribute("data-placeholder")).toBe(false);
  });

  it("keeps unavailable fields disabled and exposes their validation message", () => {
    const { document } = parseHTML(renderToStaticMarkup(
      <Field label="Model" error="Choose an available model">
        <Select value="" onChange={() => {}} options={[]} placeholder="No models" disabled />
      </Field>,
    ));
    const trigger = document.querySelector('[role="combobox"]')!;
    expect(trigger.hasAttribute("disabled")).toBe(true);
    expect(trigger.textContent).toBe("No models");
    expect(trigger.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(trigger.getAttribute("aria-describedby")!)?.textContent).toBe("Choose an available model");
  });
});
