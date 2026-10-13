// NFR-006, NFR-017, ADR-005: End-to-end network allowlist verification suite.
// Acceptance criteria: Allowlist test fails on an unlisted domain.
import { describe, expect, it, vi } from "vitest";
import {
  isAllowedDestination,
  assertAllowedDestination,
  createAllowlistFetch,
  DisallowedNetworkDestinationError,
} from "../packages/core/src/index.js";

describe("M0.5: Network Allowlist & Egress Protection (NFR-017)", () => {
  const CURRENT_APP_ORIGIN = "https://app.abhyas.local";

  describe("Allowed Outbound Destinations", () => {
    it("allows user-configured Gemini API endpoints", () => {
      const geminiUrl =
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
      expect(isAllowedDestination(geminiUrl)).toBe(true);
      expect(() => assertAllowedDestination(geminiUrl)).not.toThrow();
    });

    it("allows user-configured OpenAI API endpoints", () => {
      const openAiUrl = "https://api.openai.com/v1/chat/completions";
      expect(isAllowedDestination(openAiUrl)).toBe(true);
      expect(() => assertAllowedDestination(openAiUrl)).not.toThrow();
    });

    it("allows local Ollama servers on localhost", () => {
      const ollamaLocalhost = "http://localhost:11434/api/generate";
      expect(isAllowedDestination(ollamaLocalhost)).toBe(true);
      expect(() => assertAllowedDestination(ollamaLocalhost)).not.toThrow();
    });

    it("allows local servers on 127.0.0.1 loopback", () => {
      const localLoopback = "http://127.0.0.1:8080/v1/models";
      expect(isAllowedDestination(localLoopback)).toBe(true);
      expect(() => assertAllowedDestination(localLoopback)).not.toThrow();
    });

    it("allows same-origin asset requests ('self')", () => {
      const fontUrl = "/fonts/pixelify-sans-latin-400-normal.woff2";
      expect(isAllowedDestination(fontUrl, CURRENT_APP_ORIGIN)).toBe(true);
      expect(() => assertAllowedDestination(fontUrl, CURRENT_APP_ORIGIN)).not.toThrow();
    });
  });

  describe("Rejection of Unlisted Destinations (Acceptance Criterion)", () => {
    const unlistedDestinations = [
      "https://www.google-analytics.com/g/collect",
      "https://telemetry.segment.io/v1/t",
      "https://fonts.googleapis.com/css2?family=Roboto",
      "https://fonts.gstatic.com/s/roboto/v30/test.woff2",
      "https://api.mixpanel.com/track",
      "https://sentry.io/api/12345/envelope/",
      "https://stats.wp.com/e-2024.js",
      "https://unlisted-proxy.example.com/v1/chat",
      "https://unknown-cdn.cloudflare.net/npm/package",
    ];

    for (const destination of unlistedDestinations) {
      it(`fails and blocks unlisted destination: ${destination}`, () => {
        expect(isAllowedDestination(destination, CURRENT_APP_ORIGIN)).toBe(false);

        expect(() => assertAllowedDestination(destination, CURRENT_APP_ORIGIN)).toThrowError(
          DisallowedNetworkDestinationError
        );

        expect(() => assertAllowedDestination(destination, CURRENT_APP_ORIGIN)).toThrowError(
          new RegExp(
            `Disallowed network egress attempt to "${destination.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`
          )
        );
      });
    }
  });

  describe("Allowlist Fetch Wrapper", () => {
    it("delegates allowed requests to underlying fetch", async () => {
      const mockBaseFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
      const allowlistFetch = createAllowlistFetch(mockBaseFetch, CURRENT_APP_ORIGIN);

      const response = await allowlistFetch("https://api.openai.com/v1/models");
      expect(response).toBeDefined();
      expect(mockBaseFetch).toHaveBeenCalledTimes(1);
    });

    it("intercepts and rejects unlisted requests before network invocation", async () => {
      const mockBaseFetch = vi.fn();
      const allowlistFetch = createAllowlistFetch(mockBaseFetch, CURRENT_APP_ORIGIN);

      await expect(allowlistFetch("https://telemetry.evil-tracker.com/event")).rejects.toThrowError(
        DisallowedNetworkDestinationError
      );

      expect(mockBaseFetch).not.toHaveBeenCalled();
    });
  });
});
