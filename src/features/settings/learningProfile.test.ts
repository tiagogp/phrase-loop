import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveInterfaceLang } from "@/i18n/config";
import {
  completeOnboarding,
  getLearningProfile,
  isOnboardingComplete,
  saveLearningProfile,
} from "@/features/settings/learningProfile";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function installStorage() {
  const store = new MemoryStorage();
  vi.stubGlobal("localStorage", store);
  return store;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("learning profile", () => {
  it("returns defaults when storage is empty", () => {
    installStorage();
    expect(getLearningProfile()).toMatchObject({
      level: "A1",
      nativeLang: "pt",
      targetLang: "en",
      track: "beginner",
      focus: "",
      goal: 3,
      onboardingCompleted: false,
      unlockedTabTier: 0,
    });
  });

  it("switches to English at B1 without losing the preference for lower levels", () => {
    installStorage();
    saveLearningProfile({ level: "A2", interfaceLang: "pt" });
    expect(resolveInterfaceLang(getLearningProfile())).toBe("pt");
    saveLearningProfile({ level: "B1" });
    expect(getLearningProfile().interfaceLang).toBe("pt");
    expect(resolveInterfaceLang(getLearningProfile())).toBe("en");
    saveLearningProfile({ level: "A2" });
    expect(resolveInterfaceLang(getLearningProfile())).toBe("pt");
    saveLearningProfile({ interfaceLang: "en" });
    saveLearningProfile({ level: "A1" });
    expect(getLearningProfile().interfaceLang).toBe("en");
    expect(resolveInterfaceLang(getLearningProfile())).toBe("en");
  });

  it.each([undefined, "pt"])("opens saved B1 profiles in English with preference %s", (interfaceLang) => {
    const store = installStorage();
    store.setItem("phraseloop.learningProfile.v1", JSON.stringify({
      level: "B1", nativeLang: "pt", interfaceLang,
    }));
    expect(resolveInterfaceLang(getLearningProfile())).toBe("en");
  });

  it("clamps the weekly goal and persists it through the existing goal key", () => {
    const store = installStorage();
    const profile = saveLearningProfile({ goal: 99 });
    expect(profile.goal).toBe(30);
    expect(store.getItem("phraseloop.weeklyGoal")).toBe("30");
  });

  it("persists and reloads level, focus, and completion", () => {
    installStorage();
    completeOnboarding({
      level: "A2",
      focus: "job interviews",
      goal: 4,
      createdAt: 123,
    });
    expect(isOnboardingComplete()).toBe(true);
    expect(getLearningProfile()).toMatchObject({
      level: "A2",
      focus: "job interviews",
      goal: 4,
      createdAt: 123,
      onboardingCompleted: true,
      unlockedTabTier: 0,
    });
  });

  it("persists the monotonic unlocked tab tier", () => {
    installStorage();
    expect(saveLearningProfile({ unlockedTabTier: 2 }).unlockedTabTier).toBe(2);
    expect(saveLearningProfile({ unlockedTabTier: 99 }).unlockedTabTier).toBe(3);
    expect(saveLearningProfile({ unlockedTabTier: -1 }).unlockedTabTier).toBe(3);
  });

  it("falls back safely when localStorage is unavailable", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(getLearningProfile()).toMatchObject({
      level: "A1",
      goal: 3,
      onboardingCompleted: false,
    });
    expect(() => saveLearningProfile({ focus: "travel" })).not.toThrow();
  });

  it("accepts every CEFR level while keeping the supported language scope", () => {
    installStorage();
    const profile = saveLearningProfile({
      level: "C1",
      nativeLang: "es",
      targetLang: "fr",
      track: "intermediate",
    });
    expect(profile).toMatchObject({
      level: "C1",
      nativeLang: "pt",
      targetLang: "en",
      track: "beginner",
    });
  });
});
