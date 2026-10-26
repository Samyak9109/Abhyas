// FR-005, NFR-023, M7.1: Tests for AnthropicAdapter against recorded HTTP fixtures.
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AnthropicAdapter } from "./anthropic-adapter";
import { ANTHROPIC_FIXTURES } from "./fixtures/anthropic-fixtures";
import { runProviderContractTests } from "./provider-contract.test";

function createMockFetch(responseMap: {
  models?: { status: number; body: unknown };
  stream?: { status: number; chunks: string[] };
  generate?: { status: number; body: unknown };
}): typeof fetch {
  return async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1]
  ): Promise<Response> => {
    const url = input.toString();

    if (url.includes("/v1/models")) {
      const cfg = responseMap.models || { status: 200, body: ANTHROPIC_FIXTURES.modelsSuccess };
      return new Response(JSON.stringify(cfg.body), {
        status: cfg.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.includes("/v1/messages")) {
      const body = JSON.parse(String(init?.body || "{}")) as { stream?: boolean };
      if (body.stream) {
        const cfg = responseMap.stream || {
          status: 200,
          chunks: ANTHROPIC_FIXTURES.streamSseChunks,
        };
        if (cfg.status !== 200) {
          return new Response(
            JSON.stringify({ error: { message: "Stream error", type: "api_error" } }),
            {
              status: cfg.status,
              headers: { "Content-Type": "application/json" },
            }
          );
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
        body: ANTHROPIC_FIXTURES.generateObjectSuccess,
      };
      return new Response(JSON.stringify(cfg.body), {
        status: cfg.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  };
}

describe("AnthropicAdapter", () => {
  // 1. Shared contract test verification using recorded fixtures
  runProviderContractTests("AnthropicAdapter", () => {
    return new AnthropicAdapter({
      apiKey: "sk-ant-test-key-12345",
      fetchFn: createMockFetch({}),
    });
  });

  // 2. Specific behavior tests
  it("includes direct browser access header in requests", async () => {
    let capturedHeaders: Record<string, string> | undefined;
    const trackingFetch: typeof fetch = async (_input, init) => {
      capturedHeaders = init?.headers as Record<string, string> | undefined;
      return new Response(JSON.stringify(ANTHROPIC_FIXTURES.modelsSuccess), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const adapter = new AnthropicAdapter({
      apiKey: "sk-ant-test-key",
      fetchFn: trackingFetch,
    });

    await adapter.listModels();
    expect(capturedHeaders).toBeDefined();
    const headers = capturedHeaders as Record<string, string>;
    expect(headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
    expect(headers["x-api-key"]).toBe("sk-ant-test-key");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
  });

  it("classifies API key authentication errors as auth", async () => {
    const adapter = new AnthropicAdapter({
      apiKey: "sk-ant-invalid",
      fetchFn: createMockFetch({
        models: { status: 401, body: ANTHROPIC_FIXTURES.authError },
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
    const adapter = new AnthropicAdapter({
      apiKey: "sk-ant-valid",
      fetchFn: createMockFetch({
        models: { status: 429, body: ANTHROPIC_FIXTURES.quotaError },
      }),
    });

    const res = await adapter.listModels();
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.kind).toBe("quota");
      expect(res.error.retryable).toBe(true);
    }
  });

  it("falls back to curated Claude models when /v1/models is 404", async () => {
    const adapter = new AnthropicAdapter({
      apiKey: "sk-ant-valid",
      fetchFn: createMockFetch({
        models: { status: 404, body: {} },
      }),
    });

    const res = await adapter.listModels();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.length).toBeGreaterThan(0);
      expect(res.value.some((m) => m.id.includes("claude-3-5-sonnet"))).toBe(true);
    }
  });

  it("retries once when initial object output is invalid JSON", async () => {
    let callCount = 0;
    const retryFetch: typeof fetch = async () => {
      callCount += 1;
      if (callCount === 1) {
        return new Response(
          JSON.stringify({
            content: [{ type: "text", text: "I apologize, here is not JSON." }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify(ANTHROPIC_FIXTURES.generateObjectSuccess), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const adapter = new AnthropicAdapter({
      apiKey: "sk-ant-test",
      fetchFn: retryFetch,
    });

    const schema = z.object({ status: z.string(), score: z.number() });
    const res = await adapter.generateObject([{ role: "user", content: "Test prompt" }], schema, {
      signal: new AbortController().signal,
      maxOutputTokens: 100,
    });

    expect(callCount).toBe(2);
    expect(res.ok).toBe(true);
  });
});
