// FR-005, NFR-005, NFR-023, ADR-002: Direct browser OpenAI and OpenAI-compatible provider adapter.
// Supports OpenAI direct API and OpenAI-compatible endpoints (Groq, OpenRouter, LM Studio, etc.).
import type { ZodType } from "zod";
import { assertAllowedDestination } from "../network/allowlist";
import type {
  Capabilities,
  ChatMessage,
  GenerateOptions,
  ModelInfo,
  ProviderAdapter,
  ProviderError,
  ProviderId,
  Result,
  StreamChunk,
} from "./types";

export interface OpenAIAdapterConfig {
  id?: "openai" | "openai-compatible" | undefined;
  apiKey?: string | undefined;
  baseUrl?: string | undefined;
  model?: string | undefined;
  fetchFn?: typeof fetch | undefined;
  /** Allow custom endpoint not in default static allowlist if user explicitly opted in */
  allowCustomOrigin?: boolean | undefined;
}

interface OpenAIModelItem {
  id: string;
}

interface OpenAIListModelsResponse {
  data?: OpenAIModelItem[];
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

interface OpenAIChatResponse {
  choices?: {
    message?: {
      content?: string;
    };
    finish_reason?: string;
  }[];
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

interface OpenAIChatStreamChunk {
  choices?: {
    delta?: {
      content?: string;
    };
    finish_reason?: string;
  }[];
}

export class OpenAICompatibleAdapter implements ProviderAdapter {
  readonly id: ProviderId;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly fetchFn: typeof fetch;
  private readonly allowCustomOrigin: boolean;

  constructor(config: OpenAIAdapterConfig = {}) {
    this.id = config.id || (config.baseUrl ? "openai-compatible" : "openai");
    this.apiKey = (config.apiKey || "").trim();
    this.baseUrl = (config.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
    this.defaultModel = config.model || "gpt-4o-mini";
    this.fetchFn = config.fetchFn || globalThis.fetch;
    this.allowCustomOrigin = Boolean(config.allowCustomOrigin);
  }

  private getHeaders(contentType?: string): Record<string, string> {
    const headers: Record<string, string> = {};
    if (contentType) {
      headers["Content-Type"] = contentType;
    }
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  async capabilities(): Promise<Capabilities> {
    return {
      streaming: true,
      jsonMode: "native",
      maxContextTokens: 128_000,
    };
  }

  private checkDestination(url: string): void {
    if (this.allowCustomOrigin) {
      // Validate that it's a valid https URL or localhost
      const parsed = new URL(url);
      if (
        parsed.protocol !== "https:" &&
        parsed.hostname !== "localhost" &&
        parsed.hostname !== "127.0.0.1"
      ) {
        throw new Error("Custom endpoints must use HTTPS (HTTP is allowed only for localhost)");
      }
      return;
    }
    assertAllowedDestination(url);
  }

  async listModels(): Promise<Result<ModelInfo[]>> {
    const url = `${this.baseUrl}/models`;
    try {
      this.checkDestination(url);
      const res = await this.fetchFn(url, {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as OpenAIListModelsResponse;
        return {
          ok: false,
          error: this.classifyHttpError(res.status, errJson.error?.message, errJson.error?.code),
        };
      }

      const data = (await res.json()) as OpenAIListModelsResponse;
      const models: ModelInfo[] = (data.data || []).map((m) => ({
        id: m.id,
        label: m.id,
      }));

      // Sort models alphabetically
      models.sort((a, b) => a.id.localeCompare(b.id));

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

    const url = `${this.baseUrl}/chat/completions`;
    this.checkDestination(url);

    const body = {
      model: this.defaultModel,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
      max_tokens: opts.maxOutputTokens,
      temperature: opts.temperature,
    };

    let res: Response;
    try {
      res = await this.fetchFn(url, {
        method: "POST",
        headers: this.getHeaders("application/json"),
        body: JSON.stringify(body),
        signal: opts.signal,
      });
    } catch (err: unknown) {
      throw new Error(this.classifyException(err).message);
    }

    if (!res.ok) {
      const errJson = (await res.json().catch(() => ({}))) as OpenAIChatResponse;
      const classified = this.classifyHttpError(
        res.status,
        errJson.error?.message,
        errJson.error?.code
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
          const dataText = trimmed.slice(5).trim();
          if (!dataText || dataText === "[DONE]") continue;

          try {
            const parsed = JSON.parse(dataText) as OpenAIChatStreamChunk;
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              yield { delta, isComplete: false };
            }
          } catch {
            // Partial chunk or non-json line; ignore
          }
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

    const url = `${this.baseUrl}/chat/completions`;
    this.checkDestination(url);

    // Try once, and retry once on schema/json parsing failure (architecture.md section 7).
    for (let attempt = 0; attempt < 2; attempt++) {
      if (opts.signal.aborted) {
        return {
          ok: false,
          error: { kind: "aborted", message: "Request cancelled by user", retryable: false },
        };
      }

      try {
        const promptMessages = [...messages];
        if (attempt === 1) {
          promptMessages.push({
            role: "user",
            content:
              "Please output strictly valid JSON conforming exactly to the requested schema.",
          });
        }

        const body = {
          model: this.defaultModel,
          messages: promptMessages.map((m) => ({ role: m.role, content: m.content })),
          response_format: { type: "json_object" },
          max_tokens: opts.maxOutputTokens,
          temperature: opts.temperature ?? 0,
        };

        const res = await this.fetchFn(url, {
          method: "POST",
          headers: this.getHeaders("application/json"),
          body: JSON.stringify(body),
          signal: opts.signal,
        });

        if (!res.ok) {
          const errJson = (await res.json().catch(() => ({}))) as OpenAIChatResponse;
          return {
            ok: false,
            error: this.classifyHttpError(res.status, errJson.error?.message, errJson.error?.code),
          };
        }

        const data = (await res.json()) as OpenAIChatResponse;
        const text = data.choices?.[0]?.message?.content;
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

  private classifyHttpError(status: number, message?: string, code?: string): ProviderError {
    const msg = message || `HTTP error ${status}`;
    if (status === 401 || code === "invalid_api_key") {
      return { kind: "auth", message: "Invalid API key or unauthorized", retryable: false };
    }
    if (
      status === 429 ||
      code === "insufficient_quota" ||
      code === "rate_limit_exceeded" ||
      msg.toLowerCase().includes("quota")
    ) {
      return { kind: "quota", message: "API rate limit or quota exceeded", retryable: true };
    }
    if (status === 404 || code === "model_not_found") {
      return {
        kind: "model_not_found",
        message: "Requested model was not found",
        retryable: false,
      };
    }
    if (status >= 500) {
      return {
        kind: "network",
        message: "Service temporarily unavailable (server error)",
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
        const isLocal =
          this.baseUrl.includes("localhost") ||
          this.baseUrl.includes("127.0.0.1") ||
          this.baseUrl.startsWith("http://");
        if (isLocal) {
          return {
            kind: "cors",
            message: `Connection failed or blocked by CORS at ${this.baseUrl}. If running a local server (e.g. LM Studio, LocalAI, vLLM), ensure it is running and CORS is enabled in server settings.`,
            retryable: true,
          };
        }
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
