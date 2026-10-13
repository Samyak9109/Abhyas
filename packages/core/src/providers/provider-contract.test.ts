// FR-005, NFR-023: Shared contract test suite for ProviderAdapter implementations.
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MockProviderAdapter } from "./mock-adapter";
import type { ProviderAdapter } from "./types";

/**
 * Shared contract test runner that can test any ProviderAdapter implementation.
 */
export function runProviderContractTests(name: string, createAdapter: () => ProviderAdapter) {
  describe(`ProviderAdapter Contract: ${name}`, () => {
    it("reports valid capabilities", async () => {
      const adapter = createAdapter();
      const caps = await adapter.capabilities();
      expect(typeof caps.streaming).toBe("boolean");
      expect(["native", "prompted", "none"]).toContain(caps.jsonMode);
      expect(caps.maxContextTokens === null || typeof caps.maxContextTokens === "number").toBe(
        true
      );
    });

    it("lists available models", async () => {
      const adapter = createAdapter();
      const res = await adapter.listModels();
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(Array.isArray(res.value)).toBe(true);
        expect(res.value.length).toBeGreaterThan(0);
        expect(res.value[0]?.id).toBeDefined();
        expect(res.value[0]?.label).toBeDefined();
      }
    });

    it("tests connection successfully", async () => {
      const adapter = createAdapter();
      const res = await adapter.testConnection();
      expect(res.ok).toBe(true);
    });

    it("streams chunks until complete", async () => {
      const adapter = createAdapter();
      const controller = new AbortController();
      const chunks: string[] = [];

      for await (const chunk of adapter.stream([{ role: "user", content: "Hello" }], {
        signal: controller.signal,
        maxOutputTokens: 100,
      })) {
        chunks.push(chunk.delta);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });

    it("aborts streaming when AbortSignal triggers", async () => {
      const adapter = createAdapter();
      const controller = new AbortController();
      controller.abort();

      let aborted = false;
      try {
        for await (const chunk of adapter.stream([{ role: "user", content: "Hello" }], {
          signal: controller.signal,
          maxOutputTokens: 100,
        })) {
          void chunk;
        }
      } catch {
        aborted = true;
      }
      expect(aborted).toBe(true);
    });

    it("generates and validates an object using Zod schema", async () => {
      const adapter = createAdapter();
      const controller = new AbortController();
      const testSchema = z.object({
        status: z.string(),
        score: z.number(),
      });

      if (adapter instanceof MockProviderAdapter) {
        adapter.setMockObjectResponse({ status: "ok", score: 85 });
      }

      const res = await adapter.generateObject(
        [{ role: "user", content: "Generate score" }],
        testSchema,
        { signal: controller.signal, maxOutputTokens: 100 }
      );

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.status).toBe("ok");
        expect(res.value.score).toBe(85);
      }
    });

    it("classifies schema invalidation as invalid_output error", async () => {
      const adapter = createAdapter();
      const controller = new AbortController();
      const strictSchema = z.object({
        requiredField: z.string(),
      });

      if (adapter instanceof MockProviderAdapter) {
        adapter.setMockObjectResponse({ wrongField: 123 });
      }

      const res = await adapter.generateObject(
        [{ role: "user", content: "Generate payload" }],
        strictSchema,
        { signal: controller.signal, maxOutputTokens: 100 }
      );

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.kind).toBe("invalid_output");
        expect(res.error.retryable).toBe(true);
      }
    });
  });
}

// Execute contract test against MockProviderAdapter
runProviderContractTests("MockProviderAdapter", () => new MockProviderAdapter());
