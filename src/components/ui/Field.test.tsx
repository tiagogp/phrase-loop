import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { Field, Input, Textarea } from "./Field";

describe("accessible field relationships", () => {
  it("gives each input a unique label and its own description", () => {
    const { document } = parseHTML(renderToStaticMarkup(<>
      <Field label="First name" hint="Use your preferred name"><Input /></Field>
      <Field label="Notes" hint="Optional"><Textarea /></Field>
    </>));
    const controls = [...document.querySelectorAll("input, textarea")];
    expect(new Set(controls.map(control => control.id)).size).toBe(2);
    for (const control of controls) {
      expect([...document.querySelectorAll("label")].some(label => label.getAttribute("for") === control.id)).toBe(true);
      expect(document.getElementById(control.getAttribute("aria-describedby")!)?.textContent).toBeTruthy();
    }
  });

  it("associates the active error instead of announcing stale helper text", () => {
    const { document } = parseHTML(renderToStaticMarkup(
      <Field label="Email" htmlFor="email" hint="We'll send a receipt" error="Enter a valid email"><Input /></Field>,
    ));
    const input = document.querySelector("input")!;
    const message = document.getElementById(input.getAttribute("aria-describedby")!)!;
    expect(input.id).toBe("email");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(message.textContent).toBe("Enter a valid email");
    expect(message.getAttribute("role")).toBe("alert");
  });

  it("names a group without pointing a label at a nonexistent input", () => {
    const { document } = parseHTML(renderToStaticMarkup(
      <Field group label="Scenario" hint="Choose one"><button>Work</button><button>Travel</button></Field>,
    ));
    const group = document.querySelector('[role="group"]')!;
    expect(document.getElementById(group.getAttribute("aria-labelledby")!)?.textContent).toBe("Scenario");
    expect(document.querySelector("label")).toBeNull();
    expect(document.querySelectorAll("button").length).toBe(2);
  });
});
