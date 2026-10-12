import { expect, it } from "vitest";
import { audioFilesIn, renderMarkdown, transcribeModes } from "./check-codeswitch-transcription.mjs";

it("keeps only audio files, in a stable order", () => {
  expect(audioFilesIn(["notes.txt", "b-misto.webm", "a-pt.WAV", "c.m4a"])).toEqual(["a-pt.WAV", "b-misto.webm", "c.m4a"]);
});

it("asks the app once per mode, forcing pt/en and leaving auto unset", async () => {
  const languages = [];
  const fetchImpl = async (_url, init) => {
    const language = init.body.get("language");
    languages.push(language);
    if (language === "en") return new Response(JSON.stringify({ error: "falhou" }), { status: 502 });
    return new Response(JSON.stringify({ text: language === "pt" ? " eu travei " : "I traveled" }), { status: 200 });
  };
  const modes = await transcribeModes("clip.webm", new Uint8Array([1, 2]), { baseUrl: "http://localhost:3000", fetchImpl });

  expect(languages).toEqual([null, "pt", "en"]);
  expect(modes).toEqual({ auto: { text: "I traveled" }, pt: { text: "eu travei" }, en: { error: "falhou" } });
  const markdown = renderMarkdown({ generatedAt: "2026-10-12T00:00:00Z", files: [{ file: "clip.webm", modes }] });
  expect(markdown).toContain("| clip.webm | I traveled | eu travei | ⚠ falhou |");
});
