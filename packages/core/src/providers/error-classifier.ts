// Design intent (ADR-002, ADR-016): Shared HTTP status and runtime exception classifier for provider adapters.
// Consolidates status-code classification and network/abort handling while allowing adapter-specific overrides.

import type { ProviderError } from "./types";

export interface HttpErrorClassifierOptions {
  providerName?: string;
  authMessage?: string;
  quotaMessage?: string;
  modelNotFoundMessage?: string;
  serverErrorMessage?: string | ((status: number, message: string) => string);
  /**
   * Optional provider-specific interceptor for custom codes or error payloads.
   * If it returns a ProviderError, that error is returned immediately.
   */
  classifyCustom?: (
    status: number,
    message: string,
    rawCodeOrStatus?: string
  ) => ProviderError | undefined;
}

export function classifyHttpError(
  status: number,
  message?: string,
  rawCodeOrStatus?: string,
  options?: HttpErrorClassifierOptions
): ProviderError {
  const msg = message || `HTTP error ${status}`;

  if (options?.classifyCustom) {
    const custom = options.classifyCustom(status, msg, rawCodeOrStatus);
    if (custom) return custom;
  }

  if (status === 401 || status === 403) {
    return {
      kind: "auth",
      message:
        options?.authMessage ??
        `${options?.providerName ?? "Provider"} API authentication failed (check key permissions)`,
      retryable: false,
    };
  }

  if (status === 429) {
    return {
      kind: "quota",
      message:
        options?.quotaMessage ??
        `${options?.providerName ?? "Provider"} API rate limit or quota exceeded`,
      retryable: true,
    };
  }

  if (status === 404) {
    return {
      kind: "model_not_found",
      message:
        options?.modelNotFoundMessage ??
        `Requested ${options?.providerName ?? "provider"} model was not found`,
      retryable: false,
    };
  }

  if (status >= 500) {
    const srvMsg =
      typeof options?.serverErrorMessage === "function"
        ? options.serverErrorMessage(status, msg)
        : options?.serverErrorMessage ??
          `${options?.providerName ?? "Service"} temporarily unavailable (server error)`;
    return {
      kind: "network",
      message: srvMsg,
      retryable: true,
    };
  }

  return { kind: "unknown", message: msg, retryable: false };
}

export interface ExceptionClassifierOptions {
  providerName?: string;
  onNetworkOrFetchError?: (err: Error) => ProviderError;
  defaultNetworkFallback?: boolean;
}

export function classifyException(
  err: unknown,
  options?: ExceptionClassifierOptions
): ProviderError {
  if (err instanceof Error) {
    if (err.name === "AbortError" || err.message.toLowerCase().includes("aborted")) {
      return { kind: "aborted", message: "Request cancelled by user", retryable: false };
    }

    const isFetchError =
      (err.name === "TypeError" &&
        (err.message.includes("fetch") || err.message.includes("NetworkError"))) ||
      err.message.includes("Failed to fetch") ||
      err.message.includes("NetworkError");

    if (isFetchError && options?.onNetworkOrFetchError) {
      return options.onNetworkOrFetchError(err);
    }

    if (isFetchError) {
      return {
        kind: "network",
        message: "Network connection failure or CORS restriction",
        retryable: true,
      };
    }

    if (options?.defaultNetworkFallback) {
      return { kind: "network", message: err.message, retryable: true };
    }

    return { kind: "unknown", message: err.message, retryable: false };
  }

  return {
    kind: "unknown",
    message: options?.providerName
      ? `Unknown error communicating with ${options.providerName}`
      : "Unexpected provider error",
    retryable: false,
  };
}
