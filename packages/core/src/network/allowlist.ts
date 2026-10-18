// NFR-006, NFR-017, ADR-005, architecture.md Section 17:
// Network allowlist enforcement to guarantee zero unexpected egress.

export class DisallowedNetworkDestinationError extends Error {
  public readonly destination: string;

  constructor(destination: string, message?: string) {
    super(
      message ??
        `Disallowed network egress attempt to "${destination}". Abhyas strictly blocks unlisted outbound destinations (NFR-017).`
    );
    this.name = "DisallowedNetworkDestinationError";
    this.destination = destination;
  }
}

/**
 * Standard approved destination origins matching architecture.md Section 17 and docs/privacy-audit.md.
 */
export const ALLOWED_ORIGIN_PATTERNS: readonly (string | RegExp)[] = [
  // Gemini direct API
  "https://generativelanguage.googleapis.com",
  // OpenAI direct API
  "https://api.openai.com",
  // Local Ollama and local OpenAI-compatible servers (any port)
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  // Model host / CDN when user starts a model download (architecture.md Section 17)
  "https://huggingface.co",
  "https://cdn-lfs.huggingface.co",
];

/**
 * Checks whether a given target URL is within the approved network allowlist.
 *
 * @param target - Target URL string or URL instance
 * @param currentOrigin - Current page origin (defaults to "http://localhost:5173" if unspecified in non-browser env)
 */
export function isAllowedDestination(target: string | URL, currentOrigin?: string): boolean {
  try {
    let resolvedUrl: URL;
    if (typeof target === "string") {
      // Relative URLs (e.g. "/fonts/pixelify.woff2") resolve against currentOrigin or own origin
      const base = currentOrigin ?? "http://localhost:5173";
      resolvedUrl = new URL(target, base);
    } else {
      resolvedUrl = target;
    }

    const origin = resolvedUrl.origin;

    // 1. Same-origin ('self') is always allowed
    if (currentOrigin && origin === currentOrigin) {
      return true;
    }

    // 2. Test against allowed origin patterns
    for (const pattern of ALLOWED_ORIGIN_PATTERNS) {
      if (typeof pattern === "string") {
        if (origin === pattern) {
          return true;
        }
      } else if (pattern.test(origin)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Asserts that a target destination is in the allowlist; throws DisallowedNetworkDestinationError if not.
 */
export function assertAllowedDestination(target: string | URL, currentOrigin?: string): void {
  if (!isAllowedDestination(target, currentOrigin)) {
    const dest = typeof target === "string" ? target : target.toString();
    throw new DisallowedNetworkDestinationError(dest);
  }
}

export type FetchInput = string | URL | { url: string };

export type FetchFn<TResponse = unknown> = (
  input: FetchInput,
  init?: unknown
) => Promise<TResponse>;

/**
 * Wraps a fetch implementation with strict allowlist enforcement.
 */
export function createAllowlistFetch<TFetch extends FetchFn>(
  baseFetch: TFetch,
  currentOrigin?: string
): TFetch {
  return async function allowlistFetch(input: FetchInput, init?: unknown): Promise<unknown> {
    const urlString =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    assertAllowedDestination(urlString, currentOrigin);
    return baseFetch(input, init);
  } as TFetch;
}
