import { createServer } from "node:http";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import { OllamaProvider } from "./ollama";
import { tutorResponseSchema } from "@/features/tutor/responseSchema";
import { tutorSession } from "@/features/tutor/testFixtures";

describe("Ollama completion transport", () => {
  it("sends the tutor's JSON Schema and selected model to Ollama while preserving ordinary JSON requests", async () => {
    const bodies: Record<string, unknown>[] = [];
    const server = createServer(async (req, res) => {
      let body = "";
      for await (const chunk of req) body += chunk;
      bodies.push(JSON.parse(body));
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ choices: [{ finish_reason: "stop", message: { role: "assistant", content: '{"answer":"Try again."}' } }] }));
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    try {
      const address = server.address() as { port: number };
      const provider = new OllamaProvider({ baseUrl: `http://127.0.0.1:${address.port}`, model: "chosen-local-model" });
      const responseSchema = tutorResponseSchema({ action: "evaluate", provider: "ollama", text: "I have worked here for five years.",
        task: tutorSession().task, context: { level: "B1", minutes: 5, explanationLanguage: "en", focus: "Work", evidence: [], targetConceptId: "present-perfect-duration" } });
      const signal = new AbortController().signal;
      expect(await provider.complete("Evaluate this answer.", { responseSchema, signal, timeoutMs: 1000 })).toBe('{"answer":"Try again."}');
      await provider.complete("Return JSON.", { signal, timeoutMs: 1000 });
      expect(bodies[0]).toMatchObject({ model: "chosen-local-model", response_format: { type: "json_schema", json_schema: { ...responseSchema, strict: true } } });
      expect(bodies[1].response_format).toEqual({ type: "json_object" });
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });
});
