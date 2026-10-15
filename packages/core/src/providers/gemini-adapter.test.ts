// FR-005, NFR-023: Tests for GeminiAdapter against recorded HTTP fixtures.
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { GEMINI_FIXTURES } from "./fixtures/gemini-fixtures";
import { GeminiAdapter } from "./gemini-adapter";
import { runProviderContractTests } from "./provider-contract.test";

function createMockFetch(responseMap: {
  models?: { status: number; body: unknown };
  stream?: { status: number; chunks: string[] };
  generate?: { status: number; body: unknown };
}): typeof fetch {
  return async (
    input: Parameters<typeof fetch>[0],
    _init?: Parameters<typeof fetch>[1]
  ): Promise<Response> => {
    const url = input.toString();

    if (url.includes("/v1beta/models?")) {
      const cfg = responseMap.models || { status: 200, body: GEMINI_FIXTURES.modelsSuccess };
      return new Response(JSON.stringify(cfg.body), {
        status: cfg.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes(":streamGenerateContent")) {
      const cfg = responseMap.stream || { status: 200, chunks: GEMINI_FIXTURES.streamSseChunks };
      if (cfg.status !== 200) {
        return new Response(JSON.stringify({ error: { message: "Stream error" } }), {
          status: cfg.status,
          headers: { "Content-Type": "application/json" },
        });
      }

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const encoder = new TextEncoder();
          for (const chunk of cfg.chunks) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        },
      });

      return new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    }

    if (url.includes(":generateContent")) {
      const cfg = responseMap.generate || {
        status: 200,
        body: GEMINI_FIXTURES.generateObjectSuccess,
      };
      return new Response(JSON.stringify(cfg.body), {
        status: cfg.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  };
}

describe("GeminiAdapter", () => {
  // 1. Shared contract test verification using recorded fixtures
  runProviderContractTests("GeminiAdapter", () => {
    return new GeminiAdapter({
      apiKey: "test-gemini-key",
      fetchFn: createMockFetch({}),
    });
  });

  // 2. Specific behavior tests
  it("filters and formats supported generateContent models", async () => {
    const adapter = new GeminiAdapter({
      apiKey: "test-gemini-key",
      fetchFn: createMockFetch({
        models: { status: 200, body: GEMINI_FIXTURES.modelsSuccess },
      }),
    });

    const res = await adapter.listModels();
    expect(res.ok).toBe(true);
    if (res.ok) {
      // Embedding model was excluded
      expect(res.value.map((m) => m.id)).toEqual(["gemini-1.5-flash", "gemini-1.5-pro"]);
    }
  });

  it("classifies API key authentication errors as auth", async () => {
    const adapter = new GeminiAdapter({
      apiKey: "invalid-key",
      fetchFn: createMockFetch({
        models: { status: 400, body: GEMINI_FIXTURES.authError },
      }),
    });

    const res = await adapter.testConnection();
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe("auth");
      expect(res.error.retryable).toBe(false);
    }
  });

  it("classifies rate limit errors as quota", async () => {
    const adapter = new GeminiAdapter({
      apiKey: "valid-key",
      fetchFn: createMockFetch({
        models: { status: 429, body: GEMINI_FIXTURES.quotaError },
      }),
    });

    const res = await adapter.listModels();
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe("quota");
      expect(res.error.retryable).toBe(true);
    }
  });

  it("classifies network and CORS fetch failures as network", async () => {
    const failingFetch: typeof fetch = async () => {
      throw new TypeError("Failed to fetch");
    };

    const adapter = new GeminiAdapter({
      apiKey: "test-key",
      fetchFn: failingFetch,
    });

    const res = await adapter.listModels();
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe("network");
      expect(res.error.retryable).toBe(true);
    }
  });

  it("retries once when initial object output is invalid JSON", async () => {
    let callCount = 0;
    const retryFetch: typeof fetch = async () => {
      callCount += 1;
      if (callCount === 1) {
        return new Response(JSON.stringify(GEMINI_FIXTURES.generateObjectInvalidJson), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(GEMINI_FIXTURES.generateObjectSuccess), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const adapter = new GeminiAdapter({
      apiKey: "test-key",
      fetchFn: retryFetch,
    });

    const schema = z.object({
      status: z.string(),
      score: z.number(),
    });

    const res = await adapter.generateObject([{ role: "user", content: "Hi" }], schema, {
      signal: new AbortController().signal,
      maxOutputTokens: 200,
    });

    expect(callCount).toBe(2);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.status).toBe("ok");
      expect(res.value.score).toBe(85);
    }
  });
});
