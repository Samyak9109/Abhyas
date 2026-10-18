// FR-005, FR-023, NFR-023: Tests for OllamaAdapter against recorded HTTP fixtures.
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { OLLAMA_FIXTURES } from "./fixtures/ollama-fixtures";
import { OllamaAdapter } from "./ollama-adapter";
import { runProviderContractTests } from "./provider-contract.test";

function createMockOllamaFetch(responseMap: {
  tags?: { status: number; body?: unknown; throwError?: Error };
  chat?: { status: number; body?: unknown; chunks?: string[]; throwError?: Error };
}): typeof fetch {
  return async (
    input: Parameters<typeof fetch>[0],
    _init?: Parameters<typeof fetch>[1]
  ): Promise<Response> => {
    const url = input.toString();

    if (url.endsWith("/api/tags")) {
      if (responseMap.tags?.throwError) {
        throw responseMap.tags.throwError;
      }
      const cfg = responseMap.tags || { status: 200, body: OLLAMA_FIXTURES.modelsSuccess };
      return new Response(JSON.stringify(cfg.body), {
        status: cfg.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.endsWith("/api/chat")) {
      if (responseMap.chat?.throwError) {
        throw responseMap.chat.throwError;
      }

      const isStream =
        _init?.body && typeof _init.body === "string" && _init.body.includes('"stream":true');
      if (isStream) {
        const cfg = responseMap.chat || {
          status: 200,
          chunks: OLLAMA_FIXTURES.streamNdjsonChunks,
        };
        const chunks = cfg.chunks || OLLAMA_FIXTURES.streamNdjsonChunks;
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            const encoder = new TextEncoder();
            for (const chunk of chunks) {
              controller.enqueue(encoder.encode(chunk));
            }
            controller.close();
          },
        });
        return new Response(stream, {
          status: 200,
          headers: { "Content-Type": "application/x-ndjson" },
        });
      }

      const cfg = responseMap.chat || {
        status: 200,
        body: OLLAMA_FIXTURES.generateObjectSuccess,
      };
      return new Response(JSON.stringify(cfg.body), {
        status: cfg.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  };
}

describe("OllamaAdapter", () => {
  // 1. Shared contract test verification using recorded fixtures (acceptance criteria)
  runProviderContractTests("OllamaAdapter", () => {
    return new OllamaAdapter({
      fetchFn: createMockOllamaFetch({}),
    });
  });

  // 2. Specific behavior tests
  it("lists models and includes parameter size in label", async () => {
    const adapter = new OllamaAdapter({
      fetchFn: createMockOllamaFetch({
        tags: { status: 200, body: OLLAMA_FIXTURES.modelsSuccess },
      }),
    });

    const res = await adapter.listModels();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toHaveLength(2);
      expect(res.value[0]?.id).toBe("llama3.2:latest");
      expect(res.value[0]?.label).toBe("llama3.2:latest (3.2B)");
      expect(res.value[1]?.id).toBe("qwen2.5:latest");
      expect(res.value[1]?.label).toBe("qwen2.5:latest (1.5B)");
    }
  });

  it("classifies connection failure to localhost as CORS / server offline error", async () => {
    const adapter = new OllamaAdapter({
      fetchFn: createMockOllamaFetch({
        tags: {
          status: 0,
          throwError: new TypeError("Failed to fetch"),
        },
      }),
    });

    const res = await adapter.testConnection();
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe("cors");
      expect(res.error.message).toContain("OLLAMA_ORIGINS");
      expect(res.error.message).toContain("/guide/local-models");
      expect(res.error.retryable).toBe(true);
    }
  });

  it("classifies missing model as model_not_found error with pull suggestion", async () => {
    const adapter = new OllamaAdapter({
      model: "mistral:latest",
      fetchFn: createMockOllamaFetch({
        chat: { status: 404, body: OLLAMA_FIXTURES.modelNotFoundError },
      }),
    });

    const result = await adapter.generateObject(
      [{ role: "user", content: "Test" }],
      z.object({ status: z.string() }),
      { signal: new AbortController().signal, maxOutputTokens: 100 }
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("model_not_found");
      expect(result.error.message).toContain("ollama pull mistral:latest");
    }
  });

  it("handles valid JSON object generation and strips markdown code fences", async () => {
    const fencedResponse = {
      model: "llama3.2:latest",
      message: {
        role: "assistant",
        content: '```json\n{\n  "score": 92,\n  "passed": true\n}\n```',
      },
      done: true,
    };

    const adapter = new OllamaAdapter({
      fetchFn: createMockOllamaFetch({
        chat: { status: 200, body: fencedResponse },
      }),
    });

    const TestSchema = z.object({
      score: z.number(),
      passed: z.boolean(),
    });

    const res = await adapter.generateObject(
      [{ role: "user", content: "Score this" }],
      TestSchema,
      { signal: new AbortController().signal, maxOutputTokens: 200 }
    );

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toEqual({ score: 92, passed: true });
    }
  });

  it("retries once when Ollama returns malformed JSON", async () => {
    let callCount = 0;
    const customFetch: typeof fetch = async (input) => {
      const url = input.toString();
      if (url.endsWith("/api/chat")) {
        callCount++;
        if (callCount === 1) {
          return new Response(
            JSON.stringify({
              model: "llama3.2",
              message: { role: "assistant", content: "Not JSON at all!" },
              done: true,
            }),
            { status: 200 }
          );
        }
        return new Response(
          JSON.stringify({
            model: "llama3.2",
            message: { role: "assistant", content: JSON.stringify({ score: 100 }) },
            done: true,
          }),
          { status: 200 }
        );
      }
      return new Response("Not found", { status: 404 });
    };

    const adapter = new OllamaAdapter({ fetchFn: customFetch });
    const res = await adapter.generateObject(
      [{ role: "user", content: "Score" }],
      z.object({ score: z.number() }),
      { signal: new AbortController().signal, maxOutputTokens: 100 }
    );

    expect(callCount).toBe(2);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toEqual({ score: 100 });
    }
  });

  it("blocks insecure HTTP custom base URLs on non-localhost", async () => {
    const adapter = new OllamaAdapter({
      baseUrl: "http://remote-ollama.example.com:11434",
      allowCustomOrigin: true,
      fetchFn: async () => new Response("ok"),
    });

    const res = await adapter.testConnection();
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toContain("HTTPS");
    }
  });
});
