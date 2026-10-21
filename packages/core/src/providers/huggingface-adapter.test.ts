// FR-005, NFR-023, M7.1: Tests for HuggingFaceAdapter against recorded HTTP fixtures.
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { HUGGINGFACE_FIXTURES } from "./fixtures/huggingface-fixtures";
import { HuggingFaceAdapter } from "./huggingface-adapter";
import { runProviderContractTests } from "./provider-contract.test";

function createMockFetch(responseMap: {
  models?: { status: number; body: unknown };
  stream?: { status: number; chunks: string[] };
  generate?: { status: number; body: unknown };
  testConn?: { status: number; body: unknown };
}): typeof fetch {
  return async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1]
  ): Promise<Response> => {
    const url = input.toString();

    if (url.includes("/api/models")) {
      const cfg = responseMap.models || { status: 200, body: HUGGINGFACE_FIXTURES.modelsSuccess };
      return new Response(JSON.stringify(cfg.body), {
        status: cfg.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("/chat/completions")) {
      const body = JSON.parse(String(init?.body || "{}")) as {
        stream?: boolean;
        max_tokens?: number;
      };

      if (body.max_tokens === 1 && !body.stream) {
        // Connection test ping
        const cfg = responseMap.testConn || {
          status: 200,
          body: { choices: [{ message: { content: "pong" } }] },
        };
        return new Response(JSON.stringify(cfg.body), {
          status: cfg.status,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (body.stream) {
        const cfg = responseMap.stream || {
          status: 200,
          chunks: HUGGINGFACE_FIXTURES.streamSseChunks,
        };
        if (cfg.status !== 200) {
          return new Response(JSON.stringify({ error: "Stream error" }), {
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

      const cfg = responseMap.generate || {
        status: 200,
        body: HUGGINGFACE_FIXTURES.generateObjectSuccess,
      };
      return new Response(JSON.stringify(cfg.body), {
        status: cfg.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  };
}

describe("HuggingFaceAdapter", () => {
  // 1. Shared contract test verification using recorded fixtures
  runProviderContractTests("HuggingFaceAdapter", () => {
    return new HuggingFaceAdapter({
      apiKey: "hf_testToken1234567890",
      fetchFn: createMockFetch({}),
    });
  });

  // 2. Specific behavior tests
  it("includes Bearer authorization header with Hugging Face token", async () => {
    let capturedHeaders: Record<string, string> | undefined;
    const trackingFetch: typeof fetch = async (_input, init) => {
      capturedHeaders = init?.headers as Record<string, string> | undefined;
      return new Response(JSON.stringify({ choices: [{ message: { content: "pong" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const adapter = new HuggingFaceAdapter({
      apiKey: "hf_superSecretToken",
      fetchFn: trackingFetch,
    });

    await adapter.testConnection();
    expect(capturedHeaders).toBeDefined();
    const headers = capturedHeaders as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer hf_superSecretToken");
  });

  it("classifies authentication errors as auth", async () => {
    const adapter = new HuggingFaceAdapter({
      apiKey: "hf_invalid",
      fetchFn: createMockFetch({
        testConn: { status: 401, body: HUGGINGFACE_FIXTURES.authError },
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
    const adapter = new HuggingFaceAdapter({
      apiKey: "hf_valid",
      fetchFn: createMockFetch({
        testConn: { status: 429, body: HUGGINGFACE_FIXTURES.quotaError },
      }),
    });

    const res = await adapter.testConnection();
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe("quota");
      expect(res.error.retryable).toBe(true);
    }
  });

  it("retries once when initial object output is invalid JSON", async () => {
    let callCount = 0;
    const retryFetch: typeof fetch = async () => {
      callCount += 1;
      if (callCount === 1) {
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "Invalid non-JSON raw response" } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify(HUGGINGFACE_FIXTURES.generateObjectSuccess), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const adapter = new HuggingFaceAdapter({
      apiKey: "hf_test",
      fetchFn: retryFetch,
    });

    const schema = z.object({ status: z.string(), score: z.number() });
    const res = await adapter.generateObject(
      [{ role: "user", content: "Test prompt" }],
      schema,
      { signal: new AbortController().signal, maxOutputTokens: 100 }
    );

    expect(callCount).toBe(2);
    expect(res.ok).toBe(true);
  });
});
