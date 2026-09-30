import { describe, expect, it } from "vitest";
import { demoFetchResponse } from "./landingDemo";

describe("landing preview API boundary", () => {
  it("keeps waitlist submissions and static resources on the real server", () => {
    expect(demoFetchResponse("/api/waitlist", { method: "POST" }, "pt")).toBeNull();
    expect(demoFetchResponse("/logo.svg", undefined, "en")).toBeNull();
  });

  it("explains unsupported app actions instead of falling through to a 404", async () => {
    const response = demoFetchResponse("/api/level-test", { method: "POST" }, "pt")!;
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("aplicativo completo") });
  });

  it("does not return invalid text bytes disguised as audio", async () => {
    for (const path of ["/api/tts", "/api/discover/audio/sample"]) {
      const response = demoFetchResponse(path, undefined, "en")!;
      expect(response.ok).toBe(false);
      expect(response.headers.get("content-type")).toBe("application/json");
    }
  });

  it("provides a bounded sample exchange without evaluating learner input", async () => {
    const request = (count: number) => ({ method: "POST", body: JSON.stringify({ history: Array.from({ length: count }, () => ({ role: "user", text: "sample" })) }) });
    const opening = await demoFetchResponse("/api/conversation", request(0), "en")!.json();
    const reply = await demoFetchResponse("/api/conversation", request(1), "en")!.json();
    const last = await demoFetchResponse("/api/conversation", request(20), "en")!.json();
    expect(opening.reply).toContain("What are you working on");
    expect(reply.reply).not.toBe(opening.reply);
    expect(last.reply).toContain("end of our sample conversation");
  });
});
