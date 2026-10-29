// FR-005, NFR-005, NFR-017, ADR-002, M7.1: Anthropic Claude provider adapter.
// Direct browser calls to Anthropic Messages API with danger header, streaming SSE,
// schema-constrained object generation, and classified errors.
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

export interface AnthropicAdapterConfig {
  apiKey?: string | undefined;
  baseUrl?: string | undefined;
  model?: string | undefined;
  fetchFn?: typeof fetch | undefined;
}

interface AnthropicModelItem {
  id: string;
  display_name?: string;
  type?: string;
}

interface AnthropicListModelsResponse {
  data?: AnthropicModelItem[];
  error?: {
    type?: string;
    message?: string;
  };
}

interface AnthropicMessageResponse {
  content?: {
    type: string;
    text?: string;
  }[];
  error?: {
    type?: string;
    message?: string;
  };
}

const CURATED_CLAUDE_MODELS: ModelInfo[] = [
  { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
  { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
  { id: "claude-3-opus-20240229", label: "Claude 3 Opus" },
];

export class AnthropicAdapter implements ProviderAdapter {
  readonly id: ProviderId = "anthropic";
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly fetchFn: typeof fetch;

  constructor(config: AnthropicAdapterConfig = {}) {
    this.apiKey = (config.apiKey || "").trim();
    this.baseUrl = (config.baseUrl || "https://api.anthropic.com/v1").replace(/\/+$/, "");
    this.defaultModel = config.model || "claude-3-5-sonnet-20241022";
    this.fetchFn = config.fetchFn || globalThis.fetch;
  }

  private getHeaders(contentType?: string): Record<string, string> {
    const headers: Record<string, string> = {
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    };
    if (contentType) {
      headers["Content-Type"] = contentType;
    }
    if (this.apiKey) {
      headers["x-api-key"] = this.apiKey;
    }
    return headers;
  }

  async capabilities(): Promise<Capabilities> {
    return {
      streaming: true,
      jsonMode: "prompted",
      maxContextTokens: 200_000,
    };
  }

  private checkDestination(url: string): void {
    assertAllowedDestination(url);
  }

  private formatMessages(messages: ChatMessage[]): {
    system: string | undefined;
    formatted: { role: "user" | "assistant"; content: string }[];
  } {
    const systemParts: string[] = [];
    const formatted: { role: "user" | "assistant"; content: string }[] = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemParts.push(msg.content);
      } else {
        const last = formatted[formatted.length - 1];
        if (last && last.role === msg.role) {
          // Merge consecutive same-role messages
          last.content += `\n\n${msg.content}`;
        } else {
          formatted.push({ role: msg.role, content: msg.content });
        }
      }
    }

    // Anthropic requires the first message to be role 'user'
    if (formatted.length === 0 || formatted[0]?.role !== "user") {
      formatted.unshift({ role: "user", content: "Begin interview context." });
    }

    return {
      system: systemParts.length > 0 ? systemParts.join("\n\n") : undefined,
      formatted,
    };
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
        // If models endpoint isn't supported or returns 404, fallback to curated list if auth passes
        if (res.status === 404) {
          return { ok: true, value: CURATED_CLAUDE_MODELS };
        }
        const errJson = (await res.json().catch(() => ({}))) as AnthropicListModelsResponse;
        return {
          ok: false,
          error: this.classifyHttpError(res.status, errJson.error?.message, errJson.error?.type),
        };
      }

      const data = (await res.json()) as AnthropicListModelsResponse;
      if (data.data && Array.isArray(data.data) && data.data.length > 0) {
        const models: ModelInfo[] = data.data.map((m) => ({
          id: m.id,
          label: m.display_name || m.id,
        }));
        models.sort((a, b) => a.id.localeCompare(b.id));
        return { ok: true, value: models };
      }

      return { ok: true, value: CURATED_CLAUDE_MODELS };
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

    const url = `${this.baseUrl}/messages`;
    this.checkDestination(url);

    const { system, formatted } = this.formatMessages(messages);

    const body: Record<string, unknown> = {
      model: this.defaultModel,
      messages: formatted,
      max_tokens: opts.maxOutputTokens,
      stream: true,
    };
    if (system) {
      body.system = system;
    }
    if (opts.temperature !== undefined) {
      body.temperature = opts.temperature;
    }

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
      const errJson = (await res.json().catch(() => ({}))) as AnthropicMessageResponse;
      const classified = this.classifyHttpError(
        res.status,
        errJson.error?.message,
        errJson.error?.type
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
        if (opts.signal?.aborted) {
          await reader.cancel();
          break;
        }
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data:")) {
            const dataStr = trimmed.slice(5).trim();
            if (!dataStr) continue;

            try {
              const parsed = JSON.parse(dataStr) as {
                type?: string;
                delta?: { type?: string; text?: string };
              };
              if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                yield { delta: parsed.delta.text, isComplete: false };
              }
              if (parsed.type === "message_stop") {
                yield { delta: "", isComplete: true };
                return;
              }
            } catch {
              // Ignore partial JSON chunks
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { delta: "", isComplete: true };
  }

  async generateObject<T>(
    messages: ChatMessage[],
    schema: ZodType<T>,
    opts: GenerateOptions
  ): Promise<Result<T>> {
    if (!this.apiKey) {
      return {
        ok: false,
        error: { kind: "auth", message: "API key is required", retryable: false },
      };
    }

    const url = `${this.baseUrl}/messages`;
    this.checkDestination(url);

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
              "Your previous response could not be parsed. Return ONLY raw valid JSON conforming exactly to the requested schema. No markdown formatting, no code blocks.",
          });
        }

        const { system, formatted } = this.formatMessages(promptMessages);

        const body: Record<string, unknown> = {
          model: this.defaultModel,
          messages: formatted,
          max_tokens: opts.maxOutputTokens,
          temperature: opts.temperature ?? 0,
        };
        const systemPrefix =
          "You are an expert technical interviewer evaluator. You MUST respond with strictly valid JSON matching the requested schema. Never output explanations or markdown fences around the JSON.";
        body.system = system ? `${systemPrefix}\n\n${system}` : systemPrefix;

        const res = await this.fetchFn(url, {
          method: "POST",
          headers: this.getHeaders("application/json"),
          body: JSON.stringify(body),
          signal: opts.signal,
        });

        if (!res.ok) {
          const errJson = (await res.json().catch(() => ({}))) as AnthropicMessageResponse;
          return {
            ok: false,
            error: this.classifyHttpError(res.status, errJson.error?.message, errJson.error?.type),
          };
        }

        const data = (await res.json()) as AnthropicMessageResponse;
        const textBlock = data.content?.find((c) => c.type === "text");
        const rawText = textBlock?.text?.trim() ?? "";

        if (!rawText) {
          if (attempt === 0) continue;
          return {
            ok: false,
            error: {
              kind: "invalid_output",
              message: "Anthropic returned an empty response",
              retryable: true,
            },
          };
        }

        // Strip markdown code fences if present
        const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        const cleanJson = jsonMatch && jsonMatch[1] ? jsonMatch[1].trim() : rawText;

        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(cleanJson);
        } catch {
          if (attempt === 0) continue;
          return {
            ok: false,
            error: {
              kind: "invalid_output",
              message: "Anthropic response was not valid JSON",
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

  private classifyHttpError(status: number, message?: string, errType?: string): ProviderError {
    return sharedClassifyHttpError(status, message, errType, {
      providerName: "Anthropic",
      authMessage: "Invalid Anthropic API key or unauthorized",
      quotaMessage: "Anthropic rate limit exceeded",
      modelNotFoundMessage: "Requested Claude model was not found",
      serverErrorMessage: "Anthropic service temporarily unavailable (server error)",
      classifyCustom: (_st, msg, errT) => {
        if (errT === "authentication_error") {
          return { kind: "auth", message: "Invalid Anthropic API key or unauthorized", retryable: false };
        }
        if (
          errT === "rate_limit_error" ||
          msg.toLowerCase().includes("rate limit") ||
          msg.toLowerCase().includes("quota")
        ) {
          return { kind: "quota", message: "Anthropic rate limit exceeded", retryable: true };
        }
        if (errT === "not_found_error") {
          return { kind: "model_not_found", message: "Requested Claude model was not found", retryable: false };
        }
        return undefined;
      },
    });
  }

  private classifyException(err: unknown): ProviderError {
    return sharedClassifyException(err, {
      providerName: "Anthropic",
      defaultNetworkFallback: true,
      onNetworkOrFetchError: () => ({
        kind: "cors",
        message:
          "Network or CORS error connecting to Anthropic. Ensure your key is valid and direct browser requests are permitted.",
        retryable: true,
      }),
    });
  }
}
