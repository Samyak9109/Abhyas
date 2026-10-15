// FR-005, NFR-023: Tests for OpenAICompatibleAdapter against recorded HTTP fixtures.
import { describe, expect, it } from "vitest";
import { OPENAI_FIXTURES } from "./fixtures/openai-fixtures";
import { OpenAICompatibleAdapter } from "./openai-compatible-adapter";
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

    if (url.endsWith("/models")) {
      const cfg = responseMap.models || { status: 200, body: OPENAI_FIXTURES.modelsSuccess };
      return new Response(JSON.stringify(cfg.body), {
        status: cfg.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.endsWith("/chat/completions")) {
      // Determine if streaming or generateObject
      const isStream =
        _init?.body && typeof _init.body === "string" && _init.body.includes('"stream":true');
      if (isStream) {
        const cfg = responseMap.stream || { status: 200, chunks: OPENAI_FIXTURES.streamSseChunks };
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

      const cfg = responseMap.generate || {
        status: 200,
        body: OPENAI_FIXTURES.generateObjectSuccess,
      };
      return new Response(JSON.stringify(cfg.body), {
        status: cfg.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  };
}

describe("OpenAICompatibleAdapter", () => {
  // 1. Shared contract test verification using recorded fixtures
  runProviderContractTests("OpenAICompatibleAdapter", () => {
    return new OpenAICompatibleAdapter({
      apiKey: "sk-test-openai-key",
      fetchFn: createMockFetch({}),
    });
  });

  // 2. Specific behavior tests
  it("lists and sorts models alphabetically", async () => {
    const adapter = new OpenAICompatibleAdapter({
      apiKey: "sk-test",
      fetchFn: createMockFetch({
        models: { status: 200, body: OPENAI_FIXTURES.modelsSuccess },
      }),
    });

    const res = await adapter.listModels();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.map((m) => m.id)).toEqual(["gpt-4o", "gpt-4o-mini"]);
    }
  });

  it("classifies invalid key as auth error", async () => {
    const adapter = new OpenAICompatibleAdapter({
      apiKey: "sk-invalid",
      fetchFn: createMockFetch({
        models: { status: 401, body: OPENAI_FIXTURES.authError },
      }),
    });

    const res = await adapter.testConnection();
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe("auth");
      expect(res.error.retryable).toBe(false);
    }
  });

  it("classifies quota exceeded as quota error", async () => {
    const adapter = new OpenAICompatibleAdapter({
      apiKey: "sk-valid",
      fetchFn: createMockFetch({
        models: { status: 429, body: OPENAI_FIXTURES.quotaError },
      }),
    });

    const res = await adapter.listModels();
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe("quota");
      expect(res.error.retryable).toBe(true);
    }
  });

  it("classifies model not found as model_not_found error", async () => {
    const adapter = new OpenAICompatibleAdapter({
      apiKey: "sk-valid",
      fetchFn: createMockFetch({
        models: { status: 404, body: OPENAI_FIXTURES.modelNotFoundError },
      }),
    });

    const res = await adapter.listModels();
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe("model_not_found");
      expect(res.error.retryable).toBe(false);
    }
  });

  it("supports custom HTTPS base URLs when opted in", async () => {
    let requestedUrl = "";
    const customFetch: typeof fetch = async (input) => {
      requestedUrl = input.toString();
      return new Response(JSON.stringify(OPENAI_FIXTURES.modelsSuccess), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const adapter = new OpenAICompatibleAdapter({
      apiKey: "sk-groq",
      baseUrl: "https://api.groq.com/openai/v1",
      allowCustomOrigin: true,
      fetchFn: customFetch,
    });

    const res = await adapter.testConnection();
    expect(res.ok).toBe(true);
    expect(requestedUrl).toBe("https://api.groq.com/openai/v1/models");
  });

  it("blocks insecure HTTP custom base URLs on non-localhost", async () => {
    const adapter = new OpenAICompatibleAdapter({
      apiKey: "sk-insecure",
      baseUrl: "http://insecure-api.example.com/v1",
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
