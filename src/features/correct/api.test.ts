import { afterEach, describe, expect, it, vi } from "vitest";
import { transcribeAudio } from "./api";
import { parseTranscriptionLanguage } from "@/lib/constants";

vi.mock("@/features/speech/modelStore", () => ({ watchModelNotReady: vi.fn() }));

function mockFetch() {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ text: " oi " }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("transcribeAudio language", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the forced language with the clip", async () => {
    const fetchMock = mockFetch();
    const text = await transcribeAudio(new Blob([new Uint8Array([1])], { type: "audio/webm" }), undefined, { language: "pt" });

    expect(text).toBe("oi");
    const form = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as FormData;
    expect(form.get("language")).toBe("pt");
  });

  it("omits the language when none is forced", async () => {
    const fetchMock = mockFetch();
    await transcribeAudio(new Blob([new Uint8Array([1])], { type: "audio/webm" }));

    const form = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as FormData;
    expect(form.has("language")).toBe(false);
  });
});

describe("parseTranscriptionLanguage", () => {
  it("accepts only pt and en", () => {
    expect(parseTranscriptionLanguage("pt")).toBe("pt");
    expect(parseTranscriptionLanguage("en")).toBe("en");
    expect(parseTranscriptionLanguage("auto")).toBeNull();
    expect(parseTranscriptionLanguage("")).toBeNull();
    expect(parseTranscriptionLanguage(undefined)).toBeNull();
  });
});
