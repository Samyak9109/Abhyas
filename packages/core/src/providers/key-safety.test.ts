// FR-005, NFR-005, NFR-017, ADR-002: Automated key safety test.
// Proves that API keys never appear in requests outside the configured provider origin,
// and are never leaked in error messages or logs.
import { describe, expect, it } from "vitest";
import { ANTHROPIC_FIXTURES } from "./fixtures/anthropic-fixtures";
import { GEMINI_FIXTURES } from "./fixtures/gemini-fixtures";
import { OPENAI_FIXTURES } from "./fixtures/openai-fixtures";
import { AnthropicAdapter } from "./anthropic-adapter";
import { GeminiAdapter } from "./gemini-adapter";
import { HuggingFaceAdapter } from "./huggingface-adapter";
import { OpenAICompatibleAdapter } from "./openai-compatible-adapter";

describe("API Key Egress and Leak Protection (FR-005, NFR-005)", () => {
  it("proves Gemini API keys are only sent to generativelanguage.googleapis.com", async () => {
    const SECRET_KEY = "AIzaSySuperSecretGeminiKey98765";
    const interceptedRequests: { url: string; headers: unknown; body: unknown }[] = [];

    const interceptingFetch: typeof fetch = async (input, init) => {
      interceptedRequests.push({
        url: input.toString(),
        headers: init?.headers,
        body: init?.body,
      });

      return new Response(JSON.stringify(GEMINI_FIXTURES.modelsSuccess), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const adapter = new GeminiAdapter({
      apiKey: SECRET_KEY,
      fetchFn: interceptingFetch,
    });

    await adapter.testConnection();

    expect(interceptedRequests.length).toBeGreaterThan(0);
    for (const req of interceptedRequests) {
      const parsedUrl = new URL(req.url);
      // Origin MUST strictly match Gemini approved provider origin
      expect(parsedUrl.origin).toBe("https://generativelanguage.googleapis.com");
      // Key must be in x-goog-api-key header, never in URL
      expect(req.url).not.toContain(SECRET_KEY);
      const keyHeader = (req.headers as Record<string, string>)?.["x-goog-api-key"] || "";
      expect(keyHeader).toBe(SECRET_KEY);
    }
  });

  it("proves OpenAI API keys are only sent to api.openai.com and never outside", async () => {
    const SECRET_KEY = "sk-proj-super-secret-openai-key-999";
    const interceptedRequests: { url: string; headers: unknown; body: unknown }[] = [];

    const interceptingFetch: typeof fetch = async (input, init) => {
      interceptedRequests.push({
        url: input.toString(),
        headers: init?.headers,
        body: init?.body,
      });

      return new Response(JSON.stringify(OPENAI_FIXTURES.modelsSuccess), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const adapter = new OpenAICompatibleAdapter({
      apiKey: SECRET_KEY,
      fetchFn: interceptingFetch,
    });

    await adapter.testConnection();

    expect(interceptedRequests.length).toBeGreaterThan(0);
    for (const req of interceptedRequests) {
      const parsedUrl = new URL(req.url);
      // Origin MUST strictly match OpenAI approved provider origin
      expect(parsedUrl.origin).toBe("https://api.openai.com");

      // Key must be in Authorization header, never in URL
      expect(req.url).not.toContain(SECRET_KEY);
      const authHeader = (req.headers as Record<string, string>)?.["Authorization"] || "";
      expect(authHeader).toBe(`Bearer ${SECRET_KEY}`);
    }
  });

  it("proves Anthropic API keys are only sent to api.anthropic.com and never outside (M7.1)", async () => {
    const SECRET_KEY = "sk-ant-super-secret-claude-key-777";
    const interceptedRequests: { url: string; headers: unknown; body: unknown }[] = [];

    const interceptingFetch: typeof fetch = async (input, init) => {
      interceptedRequests.push({
        url: input.toString(),
        headers: init?.headers,
        body: init?.body,
      });

      return new Response(JSON.stringify(ANTHROPIC_FIXTURES.modelsSuccess), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const adapter = new AnthropicAdapter({
      apiKey: SECRET_KEY,
      fetchFn: interceptingFetch,
    });

    await adapter.testConnection();

    expect(interceptedRequests.length).toBeGreaterThan(0);
    for (const req of interceptedRequests) {
      const parsedUrl = new URL(req.url);
      expect(parsedUrl.origin).toBe("https://api.anthropic.com");
      expect(req.url).not.toContain(SECRET_KEY);
      const xApiKey = (req.headers as Record<string, string>)?.["x-api-key"] || "";
      expect(xApiKey).toBe(SECRET_KEY);
    }
  });

  it("proves Hugging Face tokens are only sent to approved Hugging Face origins and never outside (M7.1)", async () => {
    const SECRET_KEY = "hf_superSecretToken999";
    const interceptedRequests: { url: string; headers: unknown; body: unknown }[] = [];

    const interceptingFetch: typeof fetch = async (input, init) => {
      interceptedRequests.push({
        url: input.toString(),
        headers: init?.headers,
        body: init?.body,
      });

      return new Response(JSON.stringify({ choices: [{ message: { content: "pong" } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const adapter = new HuggingFaceAdapter({
      apiKey: SECRET_KEY,
      fetchFn: interceptingFetch,
    });

    await adapter.testConnection();

    expect(interceptedRequests.length).toBeGreaterThan(0);
    for (const req of interceptedRequests) {
      const parsedUrl = new URL(req.url);
      expect([
        "https://api-inference.huggingface.co",
        "https://router.huggingface.co",
        "https://huggingface.co",
      ]).toContain(parsedUrl.origin);
      expect(req.url).not.toContain(SECRET_KEY);
      const auth = (req.headers as Record<string, string>)?.["Authorization"] || "";
      expect(auth).toBe(`Bearer ${SECRET_KEY}`);
    }
  });

  it("never includes API keys in classified ProviderError objects or messages", async () => {
    const SECRET_KEY = "AIzaSyDoNotLeakMe1234567";

    const errorFetch: typeof fetch = async () => {
      return new Response(
        JSON.stringify({
          error: {
            code: 400,
            message: `API key ${SECRET_KEY} not valid`,
            status: "INVALID_ARGUMENT",
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    };

    const adapter = new GeminiAdapter({
      apiKey: SECRET_KEY,
      fetchFn: errorFetch,
    });

    const res = await adapter.testConnection();
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).not.toContain(SECRET_KEY);
      expect(JSON.stringify(res.error)).not.toContain(SECRET_KEY);
    }
  });

  it("rejects unauthorized external destinations through allowlist enforcement", async () => {
    const SECRET_KEY = "sk-evil-key-leak-test";

    const evilAdapter = new OpenAICompatibleAdapter({
      apiKey: SECRET_KEY,
      baseUrl: "https://evil-analytics-proxy.com/v1", // unlisted third party domain
      allowCustomOrigin: false,
    });

    const res = await evilAdapter.testConnection();
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toContain("Disallowed network egress");
    }
  });
});
