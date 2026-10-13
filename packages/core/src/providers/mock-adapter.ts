// FR-005, NFR-023: Mock AI provider adapter for offline testing and deterministic simulation.
import type { ZodType } from "zod";
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

export interface MockAdapterOptions {
  id?: ProviderId;
  capabilities?: Capabilities;
  models?: ModelInfo[];
  shouldFailConnection?: boolean;
  errorToThrow?: ProviderError | undefined;
  mockStreamChunks?: string[];
  mockObjectResponse?: unknown;
}

export class MockProviderAdapter implements ProviderAdapter {
  readonly id: ProviderId;
  private readonly _capabilities: Capabilities;
  private readonly _models: ModelInfo[];
  private _shouldFailConnection: boolean;
  private _errorToThrow: ProviderError | undefined;
  private _mockStreamChunks: string[];
  private _mockObjectResponse: unknown;

  constructor(options: MockAdapterOptions = {}) {
    this.id = options.id || "gemini";
    this._capabilities = options.capabilities || {
      streaming: true,
      jsonMode: "native",
      maxContextTokens: 32768,
    };
    this._models = options.models || [
      { id: "mock-model-fast", label: "Mock Fast (Flash)" },
      { id: "mock-model-pro", label: "Mock Pro" },
    ];
    this._shouldFailConnection = Boolean(options.shouldFailConnection);
    this._errorToThrow = options.errorToThrow;
    this._mockStreamChunks = options.mockStreamChunks || [
      "Hello, ",
      "this is ",
      "a mock response.",
    ];
    this._mockObjectResponse = options.mockObjectResponse;
  }

  async capabilities(): Promise<Capabilities> {
    return this._capabilities;
  }

  async listModels(): Promise<Result<ModelInfo[]>> {
    if (this._errorToThrow) {
      return { ok: false, error: this._errorToThrow };
    }
    return { ok: true, value: this._models };
  }

  async testConnection(): Promise<Result<void>> {
    if (this._shouldFailConnection || this._errorToThrow) {
      return {
        ok: false,
        error: this._errorToThrow || {
          kind: "auth",
          message: "Mock API key validation failed",
          retryable: false,
        },
      };
    }
    return { ok: true, value: undefined };
  }

  async *stream(_messages: ChatMessage[], opts: GenerateOptions): AsyncIterable<StreamChunk> {
    if (opts.signal.aborted) {
      throw new Error("Aborted");
    }

    if (this._errorToThrow) {
      throw new Error(this._errorToThrow.message);
    }

    let tokensYielded = 0;
    for (let i = 0; i < this._mockStreamChunks.length; i++) {
      if (opts.signal.aborted) {
        return;
      }
      const chunk = this._mockStreamChunks[i]!;
      tokensYielded += chunk.length;
      if (tokensYielded > opts.maxOutputTokens) {
        // Enforce maxOutputTokens cap
        yield { delta: chunk.slice(0, opts.maxOutputTokens), isComplete: true };
        return;
      }

      const isLast = i === this._mockStreamChunks.length - 1;
      yield { delta: chunk, isComplete: isLast };
    }
  }

  async generateObject<T>(
    _messages: ChatMessage[],
    schema: ZodType<T>,
    opts: GenerateOptions
  ): Promise<Result<T>> {
    if (opts.signal.aborted) {
      return {
        ok: false,
        error: { kind: "aborted", message: "Request cancelled by user", retryable: false },
      };
    }

    if (this._errorToThrow) {
      return { ok: false, error: this._errorToThrow };
    }

    const payload = this._mockObjectResponse ?? {
      // Default fallback if no specific mock object is supplied
      mock: true,
    };

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          kind: "invalid_output",
          message: `Schema validation failed: ${parsed.error.message}`,
          retryable: true,
        },
      };
    }

    return { ok: true, value: parsed.data };
  }

  // Test helpers to update simulation behavior dynamically
  setFailConnection(fail: boolean): void {
    this._shouldFailConnection = fail;
  }

  setError(error?: ProviderError | undefined): void {
    this._errorToThrow = error;
  }

  setMockObjectResponse(response: unknown): void {
    this._mockObjectResponse = response;
  }
}
