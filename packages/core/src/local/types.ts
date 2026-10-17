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
