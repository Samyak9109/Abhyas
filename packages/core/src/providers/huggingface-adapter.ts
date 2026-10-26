// FR-005, NFR-005, NFR-017, ADR-002, M7.1: Hugging Face Inference API provider adapter.
// Direct browser calls to Hugging Face serverless / router endpoints with token auth,
// streaming SSE, schema-constrained object generation, and classified errors.
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

export interface HuggingFaceAdapterConfig {
  apiKey?: string | undefined;
  baseUrl?: string | undefined;
  model?: string | undefined;
  fetchFn?: typeof fetch | undefined;
}

interface HfModelItem {
  id?: string;
  modelId?: string;
}

interface HfChatResponse {
  choices?: {
    message?: {
      content?: string;
    };
    finish_reason?: string;
  }[];
  error?: string | { message?: string };
}

const CURATED_HF_MODELS: ModelInfo[] = [
  { id: "meta-llama/Llama-3.2-3B-Instruct", label: "Llama 3.2 3B Instruct" },
  { id: "Qwen/Qwen2.5-7B-Instruct", label: "Qwen 2.5 7B Instruct" },
  { id: "mistralai/Mistral-7B-Instruct-v0.3", label: "Mistral 7B Instruct v0.3" },
  { id: "meta-llama/Llama-3.1-8B-Instruct", label: "Llama 3.1 8B Instruct" },
];

export class HuggingFaceAdapter implements ProviderAdapter {
  readonly id: ProviderId = "huggingface";
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly fetchFn: typeof fetch;

  constructor(config: HuggingFaceAdapterConfig = {}) {
    this.apiKey = (config.apiKey || "").trim();
    this.baseUrl = (config.baseUrl || "https://api-inference.huggingface.co/v1").replace(
      /\/+$/,
      ""
    );
    this.defaultModel = config.model || "meta-llama/Llama-3.2-3B-Instruct";
    this.fetchFn = config.fetchFn || globalThis.fetch;
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
      jsonMode: "prompted",
      maxContextTokens: 32_768,
    };
  }

  private checkDestination(url: string): void {
    assertAllowedDestination(url);
  }

  async listModels(): Promise<Result<ModelInfo[]>> {
    const url =
      "https://huggingface.co/api/models?pipeline_tag=text-generation&sort=downloads&direction=-1&limit=20";
    try {
      this.checkDestination(url);
      const res = await this.fetchFn(url, {
        method: "GET",
        headers: this.getHeaders(),
      });

      if (!res.ok) {
        // Fallback gracefully to curated models if search endpoint is restricted
        return { ok: true, value: CURATED_HF_MODELS };
      }

      const data = (await res.json()) as HfModelItem[];
      if (Array.isArray(data) && data.length > 0) {
        const models: ModelInfo[] = data
          .map((m) => {
            const id = m.id || m.modelId;
            return id ? { id, label: id } : null;
          })
          .filter((m): m is ModelInfo => m !== null);

        if (models.length > 0) {
          return { ok: true, value: models };
        }
      }

      return { ok: true, value: CURATED_HF_MODELS };
    } catch {
      return { ok: true, value: CURATED_HF_MODELS };
    }
  }

  async testConnection(): Promise<Result<void>> {
    if (!this.apiKey) {
      return {
        ok: false,
        error: {
          kind: "auth",
          message: "Hugging Face User Access Token is required",
          retryable: false,
        },
      };
    }

    const url = `${this.baseUrl}/chat/completions`;
    try {
      this.checkDestination(url);
      const res = await this.fetchFn(url, {
        method: "POST",
        headers: this.getHeaders("application/json"),
        body: JSON.stringify({
          model: this.defaultModel,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1,
        }),
      });

      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as HfChatResponse;
        const errMsg = typeof errJson.error === "string" ? errJson.error : errJson.error?.message;
        return { ok: false, error: this.classifyHttpError(res.status, errMsg) };
      }

      return { ok: true, value: undefined };
    } catch (err: unknown) {
      return { ok: false, error: this.classifyException(err) };
    }
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
      const errJson = (await res.json().catch(() => ({}))) as HfChatResponse;
      const errMsg = typeof errJson.error === "string" ? errJson.error : errJson.error?.message;
      const classified = this.classifyHttpError(res.status, errMsg);
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
            if (dataStr === "[DONE]") {
              yield { delta: "", isComplete: true };
              return;
            }
            if (!dataStr) continue;

            try {
              const parsed = JSON.parse(dataStr) as {
                choices?: { delta?: { content?: string } }[];
              };
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                yield { delta: content, isComplete: false };
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
        error: { kind: "auth", message: "Hugging Face token is required", retryable: false },
      };
    }

    const url = `${this.baseUrl}/chat/completions`;
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
              "Please output strictly valid JSON conforming exactly to the requested schema. Do not enclose in markdown code blocks.",
          });
        }

        const body = {
          model: this.defaultModel,
          messages: promptMessages.map((m) => ({ role: m.role, content: m.content })),
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
          const errJson = (await res.json().catch(() => ({}))) as HfChatResponse;
          const errMsg = typeof errJson.error === "string" ? errJson.error : errJson.error?.message;
          return { ok: false, error: this.classifyHttpError(res.status, errMsg) };
        }

        const data = (await res.json()) as HfChatResponse;
        const rawText = data.choices?.[0]?.message?.content?.trim() ?? "";

        if (!rawText) {
          if (attempt === 0) continue;
          return {
            ok: false,
            error: {
              kind: "invalid_output",
              message: "Hugging Face returned empty response",
              retryable: true,
            },
          };
        }

        // Clean markdown code blocks if wrapped
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
              message: "Hugging Face response was not valid JSON",
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

  private classifyHttpError(status: number, message?: string): ProviderError {
    const msg = message || `HTTP error ${status}`;
    if (
      status === 401 ||
      status === 403 ||
      msg.toLowerCase().includes("invalid username") ||
      msg.toLowerCase().includes("unauthorized")
    ) {
      return {
        kind: "auth",
        message: "Invalid Hugging Face token or unauthorized",
        retryable: false,
      };
    }
    if (
      status === 429 ||
      msg.toLowerCase().includes("rate limit") ||
      msg.toLowerCase().includes("quota")
    ) {
      return { kind: "quota", message: "Hugging Face rate limit exceeded", retryable: true };
    }
    if (status === 404 || msg.toLowerCase().includes("does not exist")) {
      return {
        kind: "model_not_found",
        message: "Requested Hugging Face model not found or unavailable on serverless inference",
        retryable: false,
      };
    }
    if (status >= 500) {
      return {
        kind: "network",
        message: "Hugging Face service temporarily unavailable (server error)",
        retryable: true,
      };
    }
    return { kind: "unknown", message: msg, retryable: false };
  }

  private classifyException(err: unknown): ProviderError {
    if (err instanceof Error) {
      if (err.name === "AbortError" || err.message.includes("aborted")) {
        return { kind: "aborted", message: "Request cancelled by user", retryable: false };
      }
      if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
        return {
          kind: "cors",
          message: "Network or CORS error connecting to Hugging Face. Ensure your token is valid.",
          retryable: true,
        };
      }
      return { kind: "network", message: err.message, retryable: true };
    }
    return {
      kind: "unknown",
      message: "Unknown error communicating with Hugging Face",
      retryable: false,
    };
  }
}
