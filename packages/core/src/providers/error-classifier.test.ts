// Tests for shared error-classifier module (ADR-002, ADR-016).
import { describe, expect, it } from "vitest";
import { classifyHttpError, classifyException } from "./error-classifier";

describe("error-classifier", () => {
  describe("classifyHttpError", () => {
    it("classifies 401 and 403 as auth", () => {
      const res401 = classifyHttpError(401);
      expect(res401.kind).toBe("auth");
      expect(res401.retryable).toBe(false);

      const res403 = classifyHttpError(403, "Forbidden", undefined, {
        providerName: "TestProvider",
        authMessage: "Custom auth message",
      });
      expect(res403.kind).toBe("auth");
      expect(res403.message).toBe("Custom auth message");
      expect(res403.retryable).toBe(false);
    });

    it("classifies 429 as quota with retryable true", () => {
      const res = classifyHttpError(429);
      expect(res.kind).toBe("quota");
      expect(res.retryable).toBe(true);
    });

    it("classifies 404 as model_not_found with retryable false", () => {
      const res = classifyHttpError(404, undefined, undefined, {
        providerName: "TestEngine",
      });
      expect(res.kind).toBe("model_not_found");
      expect(res.retryable).toBe(false);
    });

    it("classifies >=500 as network with retryable true", () => {
      const res500 = classifyHttpError(500);
      expect(res500.kind).toBe("network");
      expect(res500.retryable).toBe(true);

      const res503 = classifyHttpError(503, "Service Unavailable", undefined, {
        serverErrorMessage: (st, msg) => `Server error ${st}: ${msg}`,
      });
      expect(res503.kind).toBe("network");
      expect(res503.message).toBe("Server error 503: Service Unavailable");
    });

    it("supports customClassifier hooks overriding standard status codes", () => {
      const res = classifyHttpError(400, "bad request", "INVALID_ARGUMENT", {
        classifyCustom: (status, _msg, raw) => {
          if (status === 400 && raw === "INVALID_ARGUMENT") {
            return { kind: "auth", message: "Invalid key argument", retryable: false };
          }
          return undefined;
        },
      });
      expect(res.kind).toBe("auth");
      expect(res.message).toBe("Invalid key argument");
    });

    it("falls back to unknown for unhandled status codes", () => {
      const res = classifyHttpError(418, "I'm a teapot");
      expect(res.kind).toBe("unknown");
      expect(res.message).toBe("I'm a teapot");
      expect(res.retryable).toBe(false);
    });
  });

  describe("classifyException", () => {
    it("classifies AbortError as aborted", () => {
      const err = new Error("The user aborted a request.");
      err.name = "AbortError";
      const res = classifyException(err);
      expect(res.kind).toBe("aborted");
      expect(res.message).toBe("Request cancelled by user");
      expect(res.retryable).toBe(false);
    });

    it("classifies fetch and NetworkError TypeErrors as network", () => {
      const err = new TypeError("Failed to fetch");
      const res = classifyException(err);
      expect(res.kind).toBe("network");
      expect(res.message).toContain("Network connection failure");
      expect(res.retryable).toBe(true);
    });

    it("supports onNetworkOrFetchError hook", () => {
      const err = new TypeError("fetch failed");
      const res = classifyException(err, {
        onNetworkOrFetchError: () => ({
          kind: "cors",
          message: "Custom CORS failure",
          retryable: true,
        }),
      });
      expect(res.kind).toBe("cors");
      expect(res.message).toBe("Custom CORS failure");
    });

    it("handles generic Error with defaultNetworkFallback", () => {
      const err = new Error("Socket disconnected");
      const resFallback = classifyException(err, { defaultNetworkFallback: true });
      expect(resFallback.kind).toBe("network");
      expect(resFallback.message).toBe("Socket disconnected");

      const resDefault = classifyException(err);
      expect(resDefault.kind).toBe("unknown");
      expect(resDefault.message).toBe("Socket disconnected");
    });

    it("handles non-Error objects safely", () => {
      const res = classifyException("something went wrong", { providerName: "TestProvider" });
      expect(res.kind).toBe("unknown");
      expect(res.message).toBe("Unknown error communicating with TestProvider");
    });
  });
});
