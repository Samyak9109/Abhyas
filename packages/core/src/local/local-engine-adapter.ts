// FR-022, FR-023, ADR-013, NFR-023: In-browser local engine provider adapter.
import type { ZodType } from "zod";
import type {
  Capabilities,
  ChatMessage,
  GenerateOptions,
  ModelInfo,
  ProviderAdapter,
  ProviderError,
  Result,
  StreamChunk,
} from "../providers/types.js";
import type { EngineProgress, LocalWorkerRequest, LocalWorkerResponse } from "./types.js";

export interface EngineWorkerBridge {
  postMessage(message: LocalWorkerRequest): void;
  onMessage(handler: (event: LocalWorkerResponse) => void): () => void;
  terminate?(): void;
}

export interface LocalEngineAdapterOptions {
  bridge?: EngineWorkerBridge;
  modelId?: string;
  availableModels?: ModelInfo[];
}

export class LocalEngineAdapter implements ProviderAdapter {
  public readonly id = "webllm" as const;

  private bridge?: EngineWorkerBridge | undefined;
  private currentModelId?: string | undefined;
  private availableModels: ModelInfo[];
  private isLoaded = false;
  private activeAbortController?: AbortController | undefined;

  constructor(options: LocalEngineAdapterOptions = {}) {
    this.bridge = options.bridge;
    this.currentModelId = options.modelId;
    this.availableModels = options.availableModels ?? [
      { id: "SmolLM2-1.7B-Instruct-q4f16_1-MLC", label: "SmolLM2 1.7B Instruct (1.05 GB)" },
      { id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", label: "Qwen2.5 1.5B Instruct (0.98 GB)" },
      { id: "Llama-3.2-3B-Instruct-q4f16_1-MLC", label: "Llama 3.2 3B Instruct (1.95 GB)" },
      { id: "Llama-3.1-8B-Instruct-q4f16_1-MLC", label: "Llama 3.1 8B Instruct (4.50 GB)" },
    ];
  }

  public setBridge(bridge: EngineWorkerBridge): void {
    this.bridge = bridge;
  }

  public getCurrentModelId(): string | undefined {
    return this.currentModelId;
  }

  public isModelLoaded(): boolean {
    return this.isLoaded;
  }

  public async capabilities(): Promise<Capabilities> {
    return {
      streaming: true,
      jsonMode: "prompted",
      maxContextTokens: 2048,
    };
  }

  public async listModels(): Promise<Result<ModelInfo[]>> {
    return { ok: true, value: this.availableModels };
  }

  public async testConnection(): Promise<Result<void>> {
    if (!this.bridge) {
      return {
        ok: false,
        error: {
          kind: "unknown",
          message: "No local engine worker bridge configured.",
          retryable: false,
        },
      };
    }

    if (!this.isLoaded || !this.currentModelId) {
      return {
        ok: false,
        error: {
          kind: "model_not_found",
          message:
            "No local model is currently loaded in memory. Please download and load a model in the Model Manager first.",
          retryable: true,
        },
      };
    }

    return { ok: true, value: undefined };
  }

  public async loadModel(
    modelId: string,
    onProgress?: (progress: EngineProgress) => void
  ): Promise<Result<void>> {
    if (!this.bridge) {
      return {
        ok: false,
        error: {
          kind: "unknown",
          message: "No local engine worker bridge available.",
          retryable: false,
        },
      };
    }

    const reqId = Math.random().toString(36).slice(2);

    return new Promise((resolve) => {
      const unsubRef: { current?: (() => void) | undefined } = {};

      const cleanup = () => {
        unsubRef.current?.();
      };

      unsubRef.current = this.bridge?.onMessage((res) => {
        if (res.id !== reqId) return;

        if (res.type === "PROGRESS") {
          onProgress?.(res.progress);
        } else if (res.type === "SUCCESS") {
          this.currentModelId = modelId;
          this.isLoaded = true;
          cleanup();
          resolve({ ok: true, value: undefined });
        } else if (res.type === "ERROR") {
          cleanup();
          resolve({
            ok: false,
            error: {
              kind: (res.error.kind as ProviderError["kind"]) || "unknown",
              message: res.error.message || "Failed to load local model in worker.",
              retryable: res.error.retryable ?? true,
            },
          });
        }
      });

      this.bridge?.postMessage({
        type: "LOAD_MODEL",
        id: reqId,
        modelId,
      });
    });
  }

  public async pauseDownload(modelId: string): Promise<Result<void>> {
    if (!this.bridge) return { ok: true, value: undefined };
    const reqId = Math.random().toString(36).slice(2);
    this.bridge.postMessage({ type: "PAUSE_DOWNLOAD", id: reqId, modelId });
    return { ok: true, value: undefined };
  }

  public async resumeDownload(modelId: string): Promise<Result<void>> {
    if (!this.bridge) return { ok: true, value: undefined };
    const reqId = Math.random().toString(36).slice(2);
    this.bridge.postMessage({ type: "RESUME_DOWNLOAD", id: reqId, modelId });
    return { ok: true, value: undefined };
  }

  public async unloadModel(): Promise<Result<void>> {
    this.cancel();
    this.isLoaded = false;
    this.currentModelId = undefined;

    if (!this.bridge) return { ok: true, value: undefined };

    const reqId = Math.random().toString(36).slice(2);
    this.bridge.postMessage({ type: "UNLOAD_MODEL", id: reqId });
    return { ok: true, value: undefined };
  }

  public async deleteModel(modelId: string): Promise<Result<void>> {
    if (this.currentModelId === modelId) {
      await this.unloadModel();
    }
    if (!this.bridge) return { ok: true, value: undefined };

    const reqId = Math.random().toString(36).slice(2);
    this.bridge.postMessage({ type: "DELETE_CACHE", id: reqId, modelId });
    return { ok: true, value: undefined };
  }

  public cancel(): void {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = undefined;
    }
    if (this.bridge) {
      const reqId = Math.random().toString(36).slice(2);
      this.bridge.postMessage({ type: "CANCEL", id: reqId });
    }
  }

  public async *stream(messages: ChatMessage[], opts: GenerateOptions): AsyncIterable<StreamChunk> {
    if (!this.bridge || !this.isLoaded) {
      throw new Error("Local model is not loaded. Please load a model before streaming.");
    }

    const reqId = Math.random().toString(36).slice(2);
    const queue: StreamChunk[] = [];
    let isDone = false;
    let streamError: Error | null = null;
    let notifyResolver: (() => void) | null = null;

    const onAbort = () => {
      this.cancel();
      isDone = true;
      if (notifyResolver) notifyResolver();
    };

    if (opts.signal.aborted) {
      onAbort();
      throw new Error("Local model inference aborted.");
    }
    opts.signal.addEventListener("abort", onAbort, { once: true });

    const unsubscribe = this.bridge.onMessage((res) => {
      if (res.id !== reqId) return;

      if (res.type === "STREAM_CHUNK") {
        queue.push({ delta: res.delta, isComplete: res.isComplete });
        if (notifyResolver) {
          notifyResolver();
          notifyResolver = null;
        }
      } else if (res.type === "STREAM_DONE") {
        isDone = true;
        if (notifyResolver) {
          notifyResolver();
          notifyResolver = null;
        }
      } else if (res.type === "ERROR") {
        streamError = new Error(res.error.message);
        isDone = true;
        if (notifyResolver) {
          notifyResolver();
          notifyResolver = null;
        }
      }
    });

    try {
      this.bridge.postMessage({
        type: "STREAM_CHAT",
        id: reqId,
        messages,
        options: {
          maxOutputTokens: opts.maxOutputTokens,
          temperature: opts.temperature,
        },
      });

      while (!isDone || queue.length > 0) {
        if (opts.signal.aborted) {
          throw new Error("Local model inference aborted.");
        }
        if (streamError) {
          throw streamError;
        }
        if (queue.length > 0) {
          yield queue.shift()!;
        } else if (!isDone) {
          await new Promise<void>((resolve) => {
            notifyResolver = resolve;
          });
        }
      }

      if (opts.signal.aborted) {
        throw new Error("Local model inference aborted.");
      }
    } finally {
      opts.signal.removeEventListener("abort", onAbort);
      unsubscribe();
    }
  }

  public async generateObject<T>(
    messages: ChatMessage[],
    schema: ZodType<T>,
    opts: GenerateOptions
  ): Promise<Result<T>> {
    // Format prompt with strict JSON output instruction (AI-011, AI-014)
    const jsonPromptMessages: ChatMessage[] = [
      ...messages,
      {
        role: "user",
        content:
          "Respond strictly with valid JSON conforming to the requested schema. Do not enclose in markdown code blocks or add explanatory prose.",
      },
    ];

    try {
      let fullText = "";
      for await (const chunk of this.stream(jsonPromptMessages, opts)) {
        fullText += chunk.delta;
      }

      // Clean markdown code blocks if the model wrapped it anyway
      let cleanJson = fullText.trim();
      if (cleanJson.startsWith("```json")) {
        cleanJson = cleanJson.slice(7);
      } else if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.slice(3);
      }
      if (cleanJson.endsWith("```")) {
        cleanJson = cleanJson.slice(0, -3);
      }
      cleanJson = cleanJson.trim();

      const parsed = JSON.parse(cleanJson);
      const validated = schema.safeParse(parsed);
      if (!validated.success) {
        return {
          ok: false,
          error: {
            kind: "invalid_output",
            message: `JSON output did not match schema: ${validated.error.message}`,
            retryable: true,
          },
        };
      }

      return { ok: true, value: validated.data };
    } catch (err) {
      if (opts.signal.aborted) {
        return {
          ok: false,
          error: {
            kind: "aborted",
            message: "Inference was cancelled by caller.",
            retryable: false,
          },
        };
      }
      return {
        ok: false,
        error: {
          kind: "invalid_output",
          message:
            err instanceof Error ? err.message : "Failed to parse local model response as JSON.",
          retryable: true,
        },
      };
    }
  }
}
