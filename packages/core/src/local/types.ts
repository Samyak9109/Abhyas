// FR-022, FR-024, ADR-013: Hardware detection, WebGPU capability, and micro-benchmark contracts.

export type DeviceType = "desktop" | "mobile" | "tablet";

export type HardwareTier = "unsupported" | "basic" | "standard" | "advanced";

export interface HardwareAdapterInfo {
  vendor?: string | undefined;
  architecture?: string | undefined;
  description?: string | undefined;
}

export interface HardwareCapabilityReport {
  supported: boolean;
  deviceType: DeviceType;
  isMobile: boolean;
  webGpuAvailable: boolean;
  adapterInfo?: HardwareAdapterInfo | undefined;
  hardwareConcurrency?: number | undefined;
  deviceMemoryGb?: number | undefined;
  storageEstimateMb?: number | undefined;
  unsupportedReason?: string | undefined;
}

export interface BenchmarkResult {
  tokensPerSecond: number;
  latencyMs: number;
  tier: HardwareTier;
  recommendedModelTierLabel: string;
  recommendedModels: readonly string[];
  notes: string[];
}

export interface HardwareRuntime {
  hasWebGpu(): Promise<boolean> | boolean;
  getAdapterInfo?(): Promise<HardwareAdapterInfo | null>;
  isMobileDevice?(): boolean;
  getConcurrency?(): number;
  getDeviceMemoryGb?(): number | undefined;
  getStorageQuotaMb?(): Promise<number | undefined>;
  runComputeBenchmark?(
    durationMs?: number
  ): Promise<{ tokensPerSecond: number; latencyMs: number }>;
}

export type ModelFormat = "safetensors" | "gguf" | "onnx";

export type EngineDownloadPhase =
  | "idle"
  | "checking_cache"
  | "downloading"
  | "paused"
  | "loading_weights"
  | "ready"
  | "error";

export interface EngineProgress {
  phase: EngineDownloadPhase;
  bytesLoaded: number;
  totalBytes: number;
  percentage: number;
  text: string;
  modelId: string;
}

export interface StorageQuotaReport {
  usageMb: number;
  quotaMb: number;
  usageBytes: number;
  quotaBytes: number;
  percentage: number;
  isNearlyFull: boolean;
  persisted: boolean;
}

export interface ModelFormatValidation {
  valid: boolean;
  format?: ModelFormat;
  error?: string;
}

export type CustomModelEngine = "webllm" | "ollama";

export interface CustomModelConfig {
  id: string;
  engine: CustomModelEngine;
  format?: ModelFormat | string;
  sizeBytes?: number;
  gatedToken?: string;
  endpointUrl?: string;
}

export interface HardwareFitEstimate {
  fit: "optimal" | "tight" | "insufficient";
  message: string;
  estimatedMemoryBytes: number;
}

export type ModelSanityStatus = "interview-ready" | "questions-only" | "not-suitable";

export interface SanityCheckStepResult {
  passed: boolean;
  latencyMs: number;
  output?: string | undefined;
  error?: string | undefined;
}

export interface ModelSanityResult {
  status: ModelSanityStatus;
  tokensPerSecond: number;
  speedPassed: boolean;
  jsonValid: boolean;
  instructionFollowing: boolean;
  testedAt: string;
  modelId?: string | undefined;
  referenceDevice?: string | undefined;
  notes?: string | undefined;
  stepResults?:
    | {
        speed?: SanityCheckStepResult | undefined;
        instructionFollowing?: SanityCheckStepResult | undefined;
        jsonValidity?: SanityCheckStepResult | undefined;
      }
    | undefined;
}

export interface CuratedModelSpeed {
  referenceDevice: string;
  tokensPerSecond: number;
  latencyMs: number;
}

export interface CuratedModel {
  id: string;
  name: string;
  engine: "webllm";
  repository: string;
  sizeBytes: number;
  minimumTier: Exclude<HardwareTier, "unsupported">;
  contextLength: number;
  format: ModelFormat;
  measuredSpeed: CuratedModelSpeed;
  sanityResult: ModelSanityResult;
  notes: string;
}

export interface CuratedCatalog {
  version: number;
  schemaVersion: number;
  updatedAt: string;
  models: CuratedModel[];
}

export type LocalWorkerRequest =
  | { type: "INIT_ENGINE"; id: string; modelId: string }
  | { type: "LOAD_MODEL"; id: string; modelId: string }
  | { type: "PAUSE_DOWNLOAD"; id: string; modelId: string }
  | { type: "RESUME_DOWNLOAD"; id: string; modelId: string }
  | { type: "CANCEL"; id: string }
  | { type: "UNLOAD_MODEL"; id: string }
  | { type: "DELETE_CACHE"; id: string; modelId: string }
  | { type: "STREAM_CHAT"; id: string; messages: unknown[]; options: unknown }
  | { type: "GET_STORAGE_USAGE"; id: string };

export type LocalWorkerResponse =
  | { type: "PROGRESS"; id: string; progress: EngineProgress }
  | { type: "STREAM_CHUNK"; id: string; delta: string; isComplete: boolean }
  | { type: "STREAM_DONE"; id: string }
  | { type: "SUCCESS"; id: string; payload?: unknown }
  | { type: "ERROR"; id: string; error: { kind: string; message: string; retryable: boolean } };
