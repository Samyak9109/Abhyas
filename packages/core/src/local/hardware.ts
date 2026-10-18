// FR-022, FR-024, ADR-013: Hardware detection, WebGPU capability, and micro-benchmark engine.
import type {
  BenchmarkResult,
  DeviceType,
  HardwareAdapterInfo,
  HardwareCapabilityReport,
  HardwareRuntime,
  HardwareTier,
} from "./types.js";

export const RECOMMENDED_MODELS_BY_TIER: Record<HardwareTier, readonly string[]> = {
  unsupported: [],
  basic: ["SmolLM2-1.7B-Instruct-q4f16_1-MLC", "Qwen2.5-1.5B-Instruct-q4f16_1-MLC"],
  standard: ["Llama-3.2-3B-Instruct-q4f16_1-MLC", "Qwen2.5-3B-Instruct-q4f16_1-MLC"],
  advanced: ["Llama-3.1-8B-Instruct-q4f16_1-MLC", "Mistral-7B-Instruct-v0.3-q4f16_1-MLC"],
};

export const TIER_LABELS: Record<HardwareTier, string> = {
  unsupported: "Unsupported",
  basic: "Basic (0.5B - 1.5B models)",
  standard: "Standard (3B models)",
  advanced: "Advanced (7B - 8B models)",
};

/**
 * Checks whether user agent or touch characteristics indicate a mobile/tablet device (FR-022, ADR-013).
 */
export function isMobileUserAgent(ua = "", maxTouchPoints = 0): boolean {
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;
  const isDirectMobile = mobileRegex.test(ua);
  // iPadOS requesting desktop site reports as Macintosh with multi-touch
  const isIPadDesktop = maxTouchPoints > 1 && /Macintosh/i.test(ua);
  return isDirectMobile || isIPadDesktop;
}

interface GlobalEnvironment {
  window?: unknown;
  navigator?: {
    userAgent?: string;
    maxTouchPoints?: number;
    hardwareConcurrency?: number;
    deviceMemory?: number;
    storage?: {
      estimate?: () => Promise<{ quota?: number; usage?: number }>;
    };
    gpu?: {
      requestAdapter?: () => Promise<{
        info?: { vendor?: string; architecture?: string; description?: string };
      } | null>;
    };
  };
  performance?: {
    now?: () => number;
  };
}

/**
 * Detects hardware capabilities including WebGPU support, device classification, and resources.
 */
export async function detectHardwareCapabilities(
  runtime?: HardwareRuntime
): Promise<HardwareCapabilityReport> {
  if (runtime) {
    const isMobile = runtime.isMobileDevice?.() ?? false;
    const webGpuAvailable = await Promise.resolve(runtime.hasWebGpu());
    const deviceType: DeviceType = isMobile ? "mobile" : "desktop";

    if (isMobile) {
      return {
        supported: false,
        deviceType,
        isMobile: true,
        webGpuAvailable,
        hardwareConcurrency: runtime.getConcurrency?.(),
        deviceMemoryGb: runtime.getDeviceMemoryGb?.(),
        unsupportedReason:
          "Local models are disabled on mobile devices (phones/tablets). Local mode runs only on desktop computers with a dedicated GPU (FR-022, ADR-013).",
      };
    }

    if (!webGpuAvailable) {
      return {
        supported: false,
        deviceType: "desktop",
        isMobile: false,
        webGpuAvailable: false,
        hardwareConcurrency: runtime.getConcurrency?.(),
        deviceMemoryGb: runtime.getDeviceMemoryGb?.(),
        unsupportedReason:
          "WebGPU is not supported or not enabled in your browser. Please use Chrome 113+, Edge 113+, or enable WebGPU hardware acceleration.",
      };
    }

    const adapterInfo = (await runtime.getAdapterInfo?.()) ?? undefined;
    const storageEstimateMb = await runtime.getStorageQuotaMb?.();

    return {
      supported: true,
      deviceType: "desktop",
      isMobile: false,
      webGpuAvailable: true,
      adapterInfo: adapterInfo ?? undefined,
      hardwareConcurrency: runtime.getConcurrency?.(),
      deviceMemoryGb: runtime.getDeviceMemoryGb?.(),
      storageEstimateMb,
    };
  }

  // Browser environment detection
  const g = typeof globalThis !== "undefined" ? (globalThis as GlobalEnvironment) : {};
  if (typeof g.window === "undefined" || typeof g.navigator === "undefined") {
    return {
      supported: false,
      deviceType: "desktop",
      isMobile: false,
      webGpuAvailable: false,
      unsupportedReason: "No browser window environment available.",
    };
  }

  const nav = g.navigator;
  const ua = nav.userAgent || "";
  const touchPoints = nav.maxTouchPoints || 0;
  const isMobile = isMobileUserAgent(ua, touchPoints);
  const deviceType: DeviceType = isMobile ? "mobile" : "desktop";

  // Phone/tablet rejection
  if (isMobile) {
    return {
      supported: false,
      deviceType,
      isMobile: true,
      webGpuAvailable: false,
      hardwareConcurrency: nav.hardwareConcurrency,
      unsupportedReason:
        "Local models are disabled on mobile devices (phones/tablets). Local mode runs only on desktop computers with a dedicated GPU (FR-022, ADR-013).",
    };
  }

  // WebGPU verification
  const hasGpuNav = Boolean(nav.gpu && typeof nav.gpu.requestAdapter === "function");
  if (!hasGpuNav) {
    return {
      supported: false,
      deviceType: "desktop",
      isMobile: false,
      webGpuAvailable: false,
      hardwareConcurrency: nav.hardwareConcurrency,
      unsupportedReason:
        "WebGPU is not supported or not enabled in your browser. Please use Chrome 113+, Edge 113+, or enable WebGPU hardware acceleration.",
    };
  }

  try {
    const adapter = await nav.gpu!.requestAdapter!();
    if (!adapter) {
      return {
        supported: false,
        deviceType: "desktop",
        isMobile: false,
        webGpuAvailable: false,
        hardwareConcurrency: nav.hardwareConcurrency,
        unsupportedReason:
          "No compatible WebGPU hardware adapter found. Ensure graphics drivers are updated.",
      };
    }

    const adapterInfo: HardwareAdapterInfo = {};
    if ("info" in adapter && adapter.info) {
      const info = adapter.info;
      adapterInfo.vendor = info.vendor;
      adapterInfo.architecture = info.architecture;
      adapterInfo.description = info.description;
    }

    let storageEstimateMb: number | undefined;
    if (nav.storage && typeof nav.storage.estimate === "function") {
      try {
        const est = await nav.storage.estimate();
        if (est.quota) {
          storageEstimateMb = Math.round(est.quota / (1024 * 1024));
        }
      } catch {
        // Ignore storage estimate failure
      }
    }

    const rawMemory = nav.deviceMemory;

    return {
      supported: true,
      deviceType: "desktop",
      isMobile: false,
      webGpuAvailable: true,
      adapterInfo,
      hardwareConcurrency: nav.hardwareConcurrency,
      deviceMemoryGb: rawMemory,
      storageEstimateMb,
    };
  } catch (err) {
    return {
      supported: false,
      deviceType: "desktop",
      isMobile: false,
      webGpuAvailable: false,
      hardwareConcurrency: nav.hardwareConcurrency,
      unsupportedReason: `WebGPU adapter initialization failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Determines hardware tier based on measured speed (tokens/sec) and capability report.
 */
export function determineHardwareTier(
  tokensPerSecond: number,
  report?: HardwareCapabilityReport
): HardwareTier {
  if (report && !report.supported) {
    return "unsupported";
  }

  if (tokensPerSecond < 15) {
    return "basic";
  }

  if (tokensPerSecond < 30) {
    return "standard";
  }

  return "advanced";
}

export interface BenchmarkOptions {
  durationMs?: number | undefined;
  report?: HardwareCapabilityReport | undefined;
}

/**
 * Runs a micro-benchmark to evaluate token decoding throughput and recommends model tier (FR-024).
 */
export async function runHardwareBenchmark(
  runtime?: HardwareRuntime,
  options: BenchmarkOptions = {}
): Promise<BenchmarkResult> {
  const report = options.report ?? (await detectHardwareCapabilities(runtime));

  if (!report.supported) {
    return {
      tokensPerSecond: 0,
      latencyMs: 0,
      tier: "unsupported",
      recommendedModelTierLabel: TIER_LABELS.unsupported,
      recommendedModels: RECOMMENDED_MODELS_BY_TIER.unsupported,
      notes: [report.unsupportedReason ?? "Device does not satisfy hardware requirements."],
    };
  }

  // If runtime provides mocked or specialized benchmark
  if (runtime?.runComputeBenchmark) {
    const start = Date.now();
    const bench = await runtime.runComputeBenchmark(options.durationMs);
    const latencyMs = bench.latencyMs || Date.now() - start;
    const tokensPerSecond = Math.round(bench.tokensPerSecond * 10) / 10;
    const tier = determineHardwareTier(tokensPerSecond, report);

    const notes: string[] = [];
    if (tokensPerSecond < 15) {
      notes.push("Measured throughput supports lightweight 0.5B - 1.5B models.");
    } else if (tokensPerSecond < 30) {
      notes.push("Solid throughput capable of running balanced 3B models.");
    } else {
      notes.push("High performance throughput capable of running 7B - 8B models.");
    }

    return {
      tokensPerSecond,
      latencyMs,
      tier,
      recommendedModelTierLabel: TIER_LABELS[tier],
      recommendedModels: RECOMMENDED_MODELS_BY_TIER[tier],
      notes,
    };
  }

  // Browser-based fallback micro-benchmark: matrix FP32 floating point operations
  const g = typeof globalThis !== "undefined" ? (globalThis as GlobalEnvironment) : {};
  const targetDurationMs = options.durationMs ?? 400;
  const now = () => g.performance?.now?.() ?? Date.now();
  const startTime = now();
  let iterations = 0;
  let accumulator = 1.0001;

  while (now() - startTime < targetDurationMs) {
    for (let i = 0; i < 50000; i++) {
      accumulator = (accumulator * 1.000001 + 0.000001) % 1000;
    }
    iterations++;
  }

  const elapsedMs = Math.max(1, now() - startTime);
  // Calibrated estimation mapping float operations to tokens/sec for modern GPUs/CPUs
  const rawOpsPerSec = (iterations * 50000) / (elapsedMs / 1000);
  const estimatedTokensPerSecond = Math.max(5, Math.round((rawOpsPerSec / 800000) * 10) / 10);

  const tier = determineHardwareTier(estimatedTokensPerSecond, report);
  const notes: string[] = [];
  if (tier === "basic") {
    notes.push("Recommended for compact 0.5B - 1.5B models for responsive feedback.");
  } else if (tier === "standard") {
    notes.push("Recommended for standard 3B models with good reasoning.");
  } else {
    notes.push("Recommended for full 7B - 8B models with rich feedback.");
  }

  return {
    tokensPerSecond: estimatedTokensPerSecond,
    latencyMs: Math.round(elapsedMs),
    tier,
    recommendedModelTierLabel: TIER_LABELS[tier],
    recommendedModels: RECOMMENDED_MODELS_BY_TIER[tier],
    notes,
  };
}

/**
 * Checks whether the current environment or runtime represents a phone or mobile device (FR-022, ADR-013).
 */
export function isPhoneDevice(runtime?: HardwareRuntime): boolean {
  if (runtime?.isMobileDevice) {
    return runtime.isMobileDevice();
  }
  const g = typeof globalThis !== "undefined" ? (globalThis as GlobalEnvironment) : {};
  const nav = g.navigator;
  if (!nav) return false;
  return isMobileUserAgent(nav.userAgent || "", nav.maxTouchPoints || 0);
}

export interface DeviceRuleValidation {
  valid: boolean;
  enforcedInputMode: "voice" | "text";
  isMobile: boolean;
  error?: string;
}

/**
 * Enforces device-level constraints for local and cloud models (FR-022, ADR-013).
 * - On phones/tablets, local mode cannot be selected or started.
 * - On PCs running local models, text-only is strictly enforced (no voice).
 */
export function validateDeviceRules(options: {
  isLocalModel: boolean;
  inputMode: "voice" | "text";
  runtime?: HardwareRuntime;
}): DeviceRuleValidation {
  const isMobile = isPhoneDevice(options.runtime);

  if (options.isLocalModel) {
    if (isMobile) {
      return {
        valid: false,
        enforcedInputMode: "text",
        isMobile: true,
        error:
          "Local models are disabled on mobile devices (phones/tablets). Local mode runs only on desktop computers with a dedicated GPU (FR-022, ADR-013).",
      };
    }

    if (options.inputMode === "voice") {
      return {
        valid: false,
        enforcedInputMode: "text",
        isMobile: false,
        error:
          "Local mode is text-only. Voice input and output are disabled to dedicate device resources to the model (FR-022, ADR-013).",
      };
    }

    return {
      valid: true,
      enforcedInputMode: "text",
      isMobile: false,
    };
  }

  return {
    valid: true,
    enforcedInputMode: options.inputMode,
    isMobile,
  };
}

