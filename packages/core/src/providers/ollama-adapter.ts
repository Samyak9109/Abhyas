// FR-005, FR-023, NFR-023, ADR-002, ADR-013: Direct browser Ollama local adapter.
// Supports native Ollama REST API (localhost:11434) with streaming and structured JSON format.
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
import {
  classifyHttpError as sharedClassifyHttpError,
  classifyException as sharedClassifyException,
} from "./error-classifier";

export interface OllamaAdapterConfig {
  baseUrl?: string | undefined;
  model?: string | undefined;
  apiKey?: string | undefined;
  fetchFn?: typeof fetch | undefined;
  /** Allow custom endpoint not in default static allowlist if user explicitly opted in */
  allowCustomOrigin?: boolean | undefined;
}

interface OllamaModelDetails {
  parent_model?: string;
  format?: string;
  family?: string;
  families?: string[];
  parameter_size?: string;
  quantization_level?: string;
}

interface OllamaModelItem {
  name: string;
  model?: string;
  size?: number;
  digest?: string;
  details?: OllamaModelDetails;
}

interface OllamaTagsResponse {
  models?: OllamaModelItem[];
  error?: string;
}

interface OllamaChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OllamaChatResponse {
  model?: string;
  created_at?: string;
  message?: OllamaChatMessage;
  done?: boolean;
  total_duration?: number;
  error?: string;
}

export class OllamaAdapter implements ProviderAdapter {
  readonly id: ProviderId = "ollama";
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly apiKey: string;
  private readonly fetchFn: typeof fetch;
  private readonly allowCustomOrigin: boolean;

  constructor(config: OllamaAdapterConfig = {}) {
    this.baseUrl = (config.baseUrl || "http://localhost:11434").replace(/\/+$/, "");
    this.defaultModel = config.model || "llama3.2";
    this.apiKey = (config.apiKey || "").trim();
    this.fetchFn = config.fetchFn || globalThis.fetch;
    this.allowCustomOrigin = Boolean(config.allowCustomOrigin);
  }

  async capabilities(): Promise<Capabilities> {
    return {
      streaming: true,
      jsonMode: "native",
      maxContextTokens: 32_768,
    };
  }

  private checkDestination(url: string): void {
    if (this.allowCustomOrigin) {
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

  async listModels(): Promise<Result<ModelInfo[]>> {
    const url = `${this.baseUrl}/api/tags`;
    try {
      this.checkDestination(url);
      const res = await this.fetchFn(url, {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as OllamaTagsResponse;
        return {
          ok: false,
          error: this.classifyHttpError(res.status, errJson.error),
        };
      }

      const data = (await res.json()) as OllamaTagsResponse;
      const models: ModelInfo[] = (data.models || []).map((m) => {
        const paramSize = m.details?.parameter_size ? ` (${m.details.parameter_size})` : "";
        return {
          id: m.name,
          label: `${m.name}${paramSize}`,
        };
      });

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

    const url = `${this.baseUrl}/api/chat`;
    this.checkDestination(url);

    const body = {
      model: this.defaultModel,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
      options: {
        temperature: opts.temperature,
        num_predict: opts.maxOutputTokens,
      },
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
      const errJson = (await res.json().catch(() => ({}))) as OllamaChatResponse;
      const classified = this.classifyHttpError(res.status, errJson.error);
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
          if (!trimmed) continue;

          try {
            const parsed = JSON.parse(trimmed) as OllamaChatResponse;
            const delta = parsed.message?.content || "";
            const isDone = Boolean(parsed.done);

            if (delta) {
              yield { delta, isComplete: isDone };
            }

            if (isDone) {
              yield { delta: "", isComplete: true };
              return;
            }
          } catch {
            // Partial JSON chunk; continue buffering
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

    const url = `${this.baseUrl}/api/chat`;
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
              "Please output strictly valid JSON conforming exactly to the requested schema. Do not enclose in markdown code blocks.",
          });
        }

        const body = {
          model: this.defaultModel,
          messages: promptMessages.map((m) => ({ role: m.role, content: m.content })),
          stream: false,
          format: "json",
          options: {
            temperature: opts.temperature ?? 0,
            num_predict: opts.maxOutputTokens,
          },
        };

        const res = await this.fetchFn(url, {
          method: "POST",
          headers: this.getHeaders("application/json"),
          body: JSON.stringify(body),
          signal: opts.signal,
        });

        if (!res.ok) {
          const errJson = (await res.json().catch(() => ({}))) as OllamaChatResponse;
          return {
            ok: false,
            error: this.classifyHttpError(res.status, errJson.error),
          };
        }

        const data = (await res.json()) as OllamaChatResponse;
        const textContent = data.message?.content || "";

        // Strip any unexpected markdown code fence wrappers
        const cleaned = textContent
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```$/i, "")
          .trim();

        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(cleaned);
        } catch {
          if (attempt === 0) continue;
          return {
            ok: false,
            error: {
              kind: "invalid_output",
              message: `Ollama output was not valid JSON: "${textContent.slice(0, 100)}"`,
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
        message: "Failed to generate valid object from Ollama",
        retryable: true,
      },
    };
  }

  private classifyHttpError(status: number, message?: string): ProviderError {
    return sharedClassifyHttpError(status, message, undefined, {
      providerName: "Ollama",
      authMessage: "Unauthorized or authentication required",
      quotaMessage: "Ollama server rate limit or queue full",
      serverErrorMessage: (st, msg) => `Ollama server error (${st}): ${msg}`,
      classifyCustom: (st, msg) => {
        if (st === 404 || msg.toLowerCase().includes("not found")) {
          return {
            kind: "model_not_found",
            message: `Model '${this.defaultModel}' not found in Ollama. Pull it with: 'ollama pull ${this.defaultModel}'`,
            retryable: false,
          };
        }
        return undefined;
      },
    });
  }

  private classifyException(err: unknown): ProviderError {
    return sharedClassifyException(err, {
      providerName: "Ollama",
      onNetworkOrFetchError: () => ({
        kind: "cors",
        message: `Could not connect to Ollama at ${this.baseUrl}. If Ollama is running, CORS may be blocking browser requests. Start Ollama with OLLAMA_ORIGINS="*" (e.g. 'set OLLAMA_ORIGINS=* && ollama serve' on Windows or 'OLLAMA_ORIGINS="*" ollama serve' on macOS/Linux). See /guide/local-models.`,
        retryable: true,
      }),
    });
  }
}
