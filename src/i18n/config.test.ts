import { describe, expect, it } from "vitest";
import { DEFAULT_UI_LANG, resolveInterfaceLang } from "./config";

describe("resolveInterfaceLang", () => {
  it("uses Portuguese below B1", () => {
    expect(resolveInterfaceLang({ level: "A1", nativeLang: "pt" })).toBe("pt");
    expect(resolveInterfaceLang({ level: "A2", nativeLang: "pt" })).toBe("pt");
  });

  it.each(["B1", "B2", "C1", "C2"] as const)("defaults to English at %s and preserves saved preferences", (level) => {
    expect(resolveInterfaceLang({ level, nativeLang: "pt" })).toBe("en");
    expect(resolveInterfaceLang({ level, nativeLang: "pt", interfaceLang: "pt" })).toBe("pt");
    expect(resolveInterfaceLang({ level, nativeLang: "pt", interfaceLang: "en" })).toBe("en");
  });

  it("respects an explicit language below B1", () => {
    expect(resolveInterfaceLang({ level: "A1", nativeLang: "pt", interfaceLang: "en" })).toBe("en");
    expect(resolveInterfaceLang({ level: "A2", nativeLang: "pt", interfaceLang: "pt" })).toBe("pt");
  });

  it("falls back to English when the native language is not Portuguese", () => {
    expect(resolveInterfaceLang({ level: "A1", nativeLang: "xx" })).toBe(DEFAULT_UI_LANG);
    expect(resolveInterfaceLang({ level: "A2", nativeLang: "es" })).toBe(DEFAULT_UI_LANG);
  });
});
