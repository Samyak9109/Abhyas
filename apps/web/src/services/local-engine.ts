// FR-022, FR-023, ADR-013: Frontend service layer for local WebLLM engine, storage, and persistence.
import {
  LocalEngineAdapter,
  calculateStorageQuotaStatus,
  runModelSanityTest,
  type EngineWorkerBridge,
  type LocalWorkerRequest,
  type LocalWorkerResponse,
  type ModelRow,
  type ModelSanityResult,
  type ProviderAdapter,
  type SanityTestOptions,
  type StorageAdapter,
  type StorageQuotaReport,
} from "@abhyas/core";

let sharedAdapter: LocalEngineAdapter | null = null;

/**
 * Creates an EngineWorkerBridge connected to the Web Worker or fallback simulation.
 */
export function createWorkerBridge(customWorker?: Worker): EngineWorkerBridge {
  let worker: Worker | null = customWorker ?? null;
  const handlers = new Set<(event: LocalWorkerResponse) => void>();

  if (!worker && typeof window !== "undefined" && typeof Worker !== "undefined") {
    try {
      worker = new Worker(new URL("../workers/local-engine.worker.ts", import.meta.url), {
        type: "module",
      });
    } catch {
      // Worker construction may fail in certain restricted contexts/test environments
      worker = null;
    }
  }

  if (worker) {
    worker.onmessage = (e: MessageEvent<LocalWorkerResponse>) => {
      for (const handler of handlers) {
        handler(e.data);
      }
    };

    return {
      postMessage: (msg: LocalWorkerRequest) => {
        worker?.postMessage(msg);
      },
      onMessage: (handler: (event: LocalWorkerResponse) => void) => {
        handlers.add(handler);
        return () => {
          handlers.delete(handler);
        };
      },
      terminate: () => {
        worker?.terminate();
      },
    };
  }

  // In-memory simulation bridge for tests or environments without Web Workers
  let activeModelId: string | null = null;
  const cachedModels = new Set<string>();

  return {
    postMessage: (msg: LocalWorkerRequest) => {
      setTimeout(() => {
        if (msg.type === "LOAD_MODEL") {
          activeModelId = msg.modelId;
          cachedModels.add(msg.modelId);
          for (const handler of handlers) {
            handler({
              type: "PROGRESS",
              id: msg.id,
              progress: {
                phase: "downloading",
                bytesLoaded: 500_000_000,
                totalBytes: 1_000_000_000,
                percentage: 50,
                text: "Downloading weights (50%)...",
                modelId: msg.modelId,
              },
            });
            handler({
              type: "PROGRESS",
              id: msg.id,
              progress: {
                phase: "loading_weights",
                bytesLoaded: 1_000_000_000,
                totalBytes: 1_000_000_000,
                percentage: 100,
                text: "Ready",
                modelId: msg.modelId,
              },
            });
            handler({ type: "SUCCESS", id: msg.id, payload: { modelId: msg.modelId } });
          }
        } else if (msg.type === "UNLOAD_MODEL") {
          activeModelId = null;
          for (const handler of handlers) {
            handler({ type: "SUCCESS", id: msg.id });
          }
        } else if (msg.type === "DELETE_CACHE") {
          cachedModels.delete(msg.modelId);
          if (activeModelId === msg.modelId) activeModelId = null;
          for (const handler of handlers) {
            handler({ type: "SUCCESS", id: msg.id });
          }
        } else if (msg.type === "STREAM_CHAT") {
          for (const handler of handlers) {
            handler({
              type: "STREAM_CHUNK",
              id: msg.id,
              delta: "Response from local model.",
              isComplete: true,
            });
            handler({ type: "STREAM_DONE", id: msg.id });
          }
        } else {
          for (const handler of handlers) {
            handler({ type: "SUCCESS", id: msg.id });
          }
        }
      }, 0);
    },
    onMessage: (handler: (event: LocalWorkerResponse) => void) => {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
    terminate: () => {
      handlers.clear();
    },
  };
}

/**
 * Returns the singleton LocalEngineAdapter instance.
 */
export function getLocalEngineAdapter(bridge?: EngineWorkerBridge): LocalEngineAdapter {
  if (!sharedAdapter) {
    sharedAdapter = new LocalEngineAdapter({
      bridge: bridge ?? createWorkerBridge(),
    });
  } else if (bridge) {
    sharedAdapter.setBridge(bridge);
  }
  return sharedAdapter;
}

/**
 * Queries browser storage quota and returns usage report (FR-023).
 */
export async function getStorageQuotaReport(): Promise<StorageQuotaReport> {
  const isBrowser = typeof navigator !== "undefined" && Boolean(navigator.storage);

  let usageBytes = 0;
  let quotaBytes = 50 * 1024 * 1024 * 1024; // Default baseline: 50GB quota assumption
  let persisted = false;

  if (isBrowser && navigator.storage) {
    try {
      if (navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        if (est.usage !== undefined) usageBytes = est.usage;
        if (est.quota !== undefined) quotaBytes = est.quota;
      }
      if (navigator.storage.persisted) {
        persisted = await navigator.storage.persisted();
      }
    } catch {
      // Storage estimation failure fallback
    }
  }

  const { percentage, isNearlyFull } = calculateStorageQuotaStatus(usageBytes, quotaBytes);

  return {
    usageBytes,
    quotaBytes,
    usageMb: Math.round(usageBytes / (1024 * 1024)),
    quotaMb: Math.round(quotaBytes / (1024 * 1024)),
    percentage,
    isNearlyFull,
    persisted,
  };
}

/**
 * Requests persistent storage from the browser (FR-023, ADR-013).
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.storage?.persist) {
    try {
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Fetches all downloaded/cached model records from storage.
 */
export async function getInstalledModels(storage: StorageAdapter): Promise<ModelRow[]> {
  try {
    return await storage.getAll<ModelRow>("models");
  } catch {
    return [];
  }
}

/**
 * Records or updates the status of a model in the IndexedDB models table.
 */
export async function recordModelStatus(
  storage: StorageAdapter,
  modelId: string,
  status: "downloading" | "paused" | "ready" | "error",
  sizeBytes = 1_000_000_000,
  options?: {
    engine?: string | undefined;
    isCustom?: boolean | undefined;
    format?: string | undefined;
    gatedToken?: string | undefined;
  }
): Promise<void> {
  try {
    const existing = await storage.get<ModelRow>("models", modelId);
    if (existing) {
      await storage.put<ModelRow>("models", {
        ...existing,
        status,
        sizeBytes: sizeBytes || existing.sizeBytes,
        ...(options?.engine ? { engine: options.engine } : {}),
        ...(options?.isCustom !== undefined ? { isCustom: options.isCustom } : {}),
        ...(options?.format ? { format: options.format } : {}),
        ...(options?.gatedToken ? { gatedToken: options.gatedToken } : {}),
      });
    } else {
      await storage.put<ModelRow>("models", {
        id: modelId,
        engine: options?.engine || "webllm",
        sizeBytes,
        status,
        ...(options?.isCustom !== undefined ? { isCustom: options.isCustom } : {}),
        ...(options?.format ? { format: options.format } : {}),
        ...(options?.gatedToken ? { gatedToken: options.gatedToken } : {}),
      });
    }
  } catch {
    // Gracefully handle storage errors
  }
}

/**
 * Removes a model record from the storage database.
 */
export async function removeModelRecord(storage: StorageAdapter, modelId: string): Promise<void> {
  try {
    await storage.delete("models", modelId);
  } catch {
    // Gracefully handle storage errors
  }
}

/**
 * Updates a model record with its measured sanity test results (FR-023, AI-006).
 */
export async function recordModelSanityResult(
  storage: StorageAdapter,
  modelId: string,
  sanityResult: ModelSanityResult
): Promise<void> {
  try {
    const existing = await storage.get<ModelRow>("models", modelId);
    if (existing) {
      await storage.put<ModelRow>("models", {
        ...existing,
        sanityResult,
      });
    } else {
      await storage.put<ModelRow>("models", {
        id: modelId,
        engine: "webllm",
        sizeBytes: 1_000_000_000,
        status: "ready",
        sanityResult,
      });
    }
  } catch {
    // Gracefully handle storage errors
  }
}

/**
 * Executes a post-load sanity test on a local model (WebLLM or Ollama adapter).
 * Persists the result into IndexedDB if storage is provided.
 */
export async function runSanityTestOnModel(
  provider: ProviderAdapter,
  modelId: string,
  storage?: StorageAdapter,
  options?: SanityTestOptions
): Promise<ModelSanityResult> {
  const result = await runModelSanityTest(provider, modelId, options);
  if (storage) {
    await recordModelSanityResult(storage, modelId, result);
  }
  return result;
}

/**
 * Executes a post-load sanity test on the loaded local model (FR-023, AI-006).
 * Persists the result into IndexedDB if storage is provided.
 */
export async function runSanityTestOnLoadedModel(
  adapter: LocalEngineAdapter,
  modelId: string,
  storage?: StorageAdapter,
  options?: SanityTestOptions
): Promise<ModelSanityResult> {
  return runSanityTestOnModel(adapter, modelId, storage, options);
}
