// FR-005, NFR-005, NFR-023, ADR-002: Direct browser Gemini provider adapter.
// Calls Google Generative Language API directly without server proxies or heavy vendor SDKs.
import type { ZodType } from "zod";
import { assertAllowedDestination } from "../network/allowlist";
import type {
  Capabilities,
  ChatMessage,
  GenerateOptions,
  ModelInfo,
  ProviderAdapter,
  ProviderError,
  Result,
  StreamChunk,
} from "./types";

export interface GeminiAdapterConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  fetchFn?: typeof fetch;
}

interface GeminiPart {
  text: string;
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

interface GeminiRequestBody {
  contents: GeminiContent[];
  systemInstruction?: { parts: GeminiPart[] };
  generationConfig?: {
    maxOutputTokens?: number;
    temperature?: number;
    responseMimeType?: string;
  };
}

interface GeminiCandidate {
  content?: {
    parts?: GeminiPart[];
  };
  finishReason?: string;
}

interface GeminiGenerateResponse {
  candidates?: GeminiCandidate[];
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

interface GeminiModelItem {
  name: string;
  displayName?: string;
  supportedGenerationMethods?: string[];
  inputTokenLimit?: number;
  outputTokenLimit?: number;
}

interface GeminiListModelsResponse {
  models?: GeminiModelItem[];
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

export class GeminiAdapter implements ProviderAdapter {
  readonly id = "gemini" as const;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly fetchFn: typeof fetch;

  constructor(config: GeminiAdapterConfig) {
    this.apiKey = config.apiKey.trim();
    this.baseUrl = (config.baseUrl || "https://generativelanguage.googleapis.com").replace(
      /\/+$/,
      ""
    );
    this.defaultModel = config.model || "gemini-1.5-flash";
    this.fetchFn = config.fetchFn || globalThis.fetch;
  }

  async capabilities(): Promise<Capabilities> {
    return {
      streaming: true,
      jsonMode: "native",
      maxContextTokens: 1_048_576,
    };
  }

  async listModels(): Promise<Result<ModelInfo[]>> {
    const url = `${this.baseUrl}/v1beta/models`;
    try {
      assertAllowedDestination(url);
      const res = await this.fetchFn(url, {
        method: "GET",
        headers: { "x-goog-api-key": this.apiKey },
      });
      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as GeminiListModelsResponse;
        return {
          ok: false,
          error: this.classifyHttpError(res.status, errJson.error?.message, errJson.error?.status),
        };
      }
      const data = (await res.json()) as GeminiListModelsResponse;
      const models = (data.models || [])
        .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m) => {
          const id = m.name.replace(/^models\//, "");
          return {
            id,
            label: m.displayName ? `${m.displayName} (${id})` : id,
          };
        });

      return { ok: true, value: models };
    } catch (err: unknown) {
      return { ok: false, error: this.classifyException(err) };
    }
  }

  async testConnection(): Promise<Result<void>> {
    const modelsResult = await this.listModels();
    if (!modelsResult.ok) {
      return { ok: false, error: modelsResult.error };
    }
    return { ok: true, value: undefined };
  }

  async *stream(messages: ChatMessage[], opts: GenerateOptions): AsyncIterable<StreamChunk> {
    if (opts.signal.aborted) {
      throw new Error("Request aborted");
    }

    const model = this.defaultModel;
    const url = `${this.baseUrl}/v1beta/models/${model}:streamGenerateContent?alt=sse`;
    assertAllowedDestination(url);

    const body = this.buildGeminiBody(messages, opts);

    let res: Response;
    try {
      res = await this.fetchFn(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey,
        },
        body: JSON.stringify(body),
        signal: opts.signal,
      });
    } catch (err: unknown) {
      throw new Error(this.classifyException(err).message);
    }

    if (!res.ok) {
      const errJson = (await res.json().catch(() => ({}))) as GeminiGenerateResponse;
      const classified = this.classifyHttpError(
        res.status,
        errJson.error?.message,
        errJson.error?.status
      );
      throw new Error(classified.message);
    }

    if (!res.body) {
      yield { delta: "", isComplete: true };
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        if (opts.signal.aborted) {
          await reader.cancel();
          return;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const jsonText = trimmed.slice(5).trim();
          if (!jsonText) continue;

          try {
            const parsed = JSON.parse(jsonText) as GeminiGenerateResponse;
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              yield { delta: text, isComplete: false };
            }
          } catch {
            // Partial chunk or non-json line; ignore
          }
        }
      }

      if (buffer.trim().startsWith("data:")) {
        const jsonText = buffer.trim().slice(5).trim();
        try {
          const parsed = JSON.parse(jsonText) as GeminiGenerateResponse;
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            yield { delta: text, isComplete: false };
          }
        } catch {
          // ignore
        }
      }

      yield { delta: "", isComplete: true };
    } finally {
      reader.releaseLock();
    }
  }

  async generateObject<T>(
    messages: ChatMessage[],
    schema: ZodType<T>,
    opts: GenerateOptions
  ): Promise<Result<T>> {
    if (opts.signal.aborted) {
      return {
        ok: false,
        error: { kind: "aborted", message: "Request cancelled by user", retryable: false },
      };
    }

    const model = this.defaultModel;
    const url = `${this.baseUrl}/v1beta/models/${model}:generateContent`;

    // Try once, and retry once on schema/json parsing failure (architecture.md section 7).
    for (let attempt = 0; attempt < 2; attempt++) {
      if (opts.signal.aborted) {
        return {
          ok: false,
          error: { kind: "aborted", message: "Request cancelled by user", retryable: false },
        };
      }

      try {
        assertAllowedDestination(url);
        const body = this.buildGeminiBody(messages, opts, true);
        const res = await this.fetchFn(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.apiKey,
          },
          body: JSON.stringify(body),
          signal: opts.signal,
        });

        if (!res.ok) {
          const errJson = (await res.json().catch(() => ({}))) as GeminiGenerateResponse;
          return {
            ok: false,
            error: this.classifyHttpError(
              res.status,
              errJson.error?.message,
              errJson.error?.status
            ),
          };
        }

        const data = (await res.json()) as GeminiGenerateResponse;
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          if (attempt === 0) continue;
          return {
            ok: false,
            error: {
              kind: "invalid_output",
              message: "Provider returned empty response",
              retryable: true,
            },
          };
        }

        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(text);
        } catch {
          if (attempt === 0) continue;
          return {
            ok: false,
            error: {
              kind: "invalid_output",
              message: "Output was not valid JSON",
              retryable: true,
            },
          };
        }

        const parsed = schema.safeParse(parsedJson);
        if (parsed.success) {
          return { ok: true, value: parsed.data };
        }

        if (attempt === 0) continue;
        return {
          ok: false,
          error: {
            kind: "invalid_output",
            message: `Schema validation failed: ${parsed.error.message}`,
            retryable: true,
          },
        };
      } catch (err: unknown) {
        return { ok: false, error: this.classifyException(err) };
      }
    }

    return {
      ok: false,
      error: {
        kind: "invalid_output",
        message: "Failed to generate valid object",
        retryable: true,
      },
    };
  }

  private buildGeminiBody(
    messages: ChatMessage[],
    opts: GenerateOptions,
    jsonMode = false
  ): GeminiRequestBody {
    const contents: GeminiContent[] = [];
    let systemInstruction: { parts: GeminiPart[] } | undefined;

    for (const msg of messages) {
      if (msg.role === "system") {
        systemInstruction = { parts: [{ text: msg.content }] };
      } else {
        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        });
      }
    }

    // Gemini requires at least one user message in contents
    if (contents.length === 0) {
      contents.push({ role: "user", parts: [{ text: "" }] });
    }

    const body: GeminiRequestBody = {
      contents,
      ...(systemInstruction ? { systemInstruction } : {}),
      generationConfig: {
        ...(opts.maxOutputTokens !== undefined ? { maxOutputTokens: opts.maxOutputTokens } : {}),
        ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
        ...(jsonMode ? { responseMimeType: "application/json" } : {}),
      },
    };

    return body;
  }

  private classifyHttpError(status: number, message?: string, errStatus?: string): ProviderError {
    const msg = message || `HTTP error ${status}`;
    if (
      status === 400 &&
      (errStatus === "INVALID_ARGUMENT" ||
        msg.includes("API_KEY_INVALID") ||
        msg.includes("key not valid"))
    ) {
      return { kind: "auth", message: "Invalid Gemini API key", retryable: false };
    }
    if (status === 401 || status === 403) {
      return {
        kind: "auth",
        message: "Gemini API authentication failed (check key permissions)",
        retryable: false,
      };
    }
    if (status === 429 || errStatus === "RESOURCE_EXHAUSTED" || msg.includes("quota")) {
      return { kind: "quota", message: "Gemini API rate limit or quota exceeded", retryable: true };
    }
    if (status === 404) {
      return {
        kind: "model_not_found",
        message: "Requested Gemini model was not found",
        retryable: false,
      };
    }
    if (status >= 500) {
      return {
        kind: "network",
        message: "Gemini service temporarily unavailable (server error)",
        retryable: true,
      };
    }
    return { kind: "unknown", message: msg, retryable: false };
  }

  private classifyException(err: unknown): ProviderError {
    if (err instanceof Error) {
      if (err.name === "AbortError" || err.message.toLowerCase().includes("aborted")) {
        return { kind: "aborted", message: "Request cancelled by user", retryable: false };
      }
      if (
        err.name === "TypeError" &&
        (err.message.includes("fetch") || err.message.includes("NetworkError"))
      ) {
        return {
          kind: "network",
          message: "Network connection failure or CORS restriction",
          retryable: true,
        };
      }
      return { kind: "unknown", message: err.message, retryable: false };
    }
    return { kind: "unknown", message: "Unexpected provider error", retryable: false };
  }
}
