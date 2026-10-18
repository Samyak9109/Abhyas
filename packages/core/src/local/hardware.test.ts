// FR-024, FR-022, ADR-013: Unit tests for hardware detection, WebGPU capability, and micro-benchmark.
import { describe, expect, it } from "vitest";
import {
  detectHardwareCapabilities,
  determineHardwareTier,
  isMobileUserAgent,
  isPhoneDevice,
  runHardwareBenchmark,
  validateDeviceRules,
  RECOMMENDED_MODELS_BY_TIER,
  TIER_LABELS,
} from "./hardware.js";
import type { HardwareRuntime } from "./types.js";

describe("Hardware Detection & Capability Checks (FR-024, M3.1)", () => {
  it("detects mobile user agents and iPadOS touch mode", () => {
    // Mobile phones
    expect(isMobileUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(true);
    expect(isMobileUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8)")).toBe(true);

    // iPadOS in desktop request mode (Macintosh UA with touch points > 1)
    expect(
      isMobileUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15", 5)
    ).toBe(true);

    // Desktop browsers
    expect(
      isMobileUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", 0)
    ).toBe(false);
    expect(
      isMobileUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36", 0)
    ).toBe(false);
    expect(isMobileUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36", 0)).toBe(false);
  });

  it("blocks local mode on mobile devices with an explanatory reason (FR-022, ADR-013)", async () => {
    const mockMobileRuntime: HardwareRuntime = {
      hasWebGpu: () => true,
      isMobileDevice: () => true,
      getConcurrency: () => 8,
    };

    const report = await detectHardwareCapabilities(mockMobileRuntime);

    expect(report.supported).toBe(false);
    expect(report.isMobile).toBe(true);
    expect(report.deviceType).toBe("mobile");
    expect(report.unsupportedReason).toContain("mobile devices");
  });

  it("reports unsupported when WebGPU is not available", async () => {
    const mockNoGpuRuntime: HardwareRuntime = {
      hasWebGpu: () => false,
      isMobileDevice: () => false,
      getConcurrency: () => 8,
    };

    const report = await detectHardwareCapabilities(mockNoGpuRuntime);

    expect(report.supported).toBe(false);
    expect(report.webGpuAvailable).toBe(false);
    expect(report.deviceType).toBe("desktop");
    expect(report.unsupportedReason).toContain("WebGPU is not supported");
  });

  it("reports supported with adapter details when WebGPU is available on desktop", async () => {
    const mockSupportedRuntime: HardwareRuntime = {
      hasWebGpu: () => true,
      isMobileDevice: () => false,
      getAdapterInfo: async () => ({
        vendor: "nvidia",
        architecture: "ada-lovelace",
        description: "NVIDIA GeForce RTX 4080",
      }),
      getConcurrency: () => 16,
      getDeviceMemoryGb: () => 16,
      getStorageQuotaMb: async () => 50000,
    };

    const report = await detectHardwareCapabilities(mockSupportedRuntime);

    expect(report.supported).toBe(true);
    expect(report.webGpuAvailable).toBe(true);
    expect(report.deviceType).toBe("desktop");
    expect(report.adapterInfo?.vendor).toBe("nvidia");
    expect(report.adapterInfo?.description).toBe("NVIDIA GeForce RTX 4080");
    expect(report.hardwareConcurrency).toBe(16);
    expect(report.deviceMemoryGb).toBe(16);
    expect(report.storageEstimateMb).toBe(50000);
    expect(report.unsupportedReason).toBeUndefined();
  });
});

describe("Tier Recommendation & Benchmark (phases.md M3.1 Acceptance Criteria)", () => {
  it("determines correct tier based on speed thresholds", () => {
    // Unsupported device
    expect(
      determineHardwareTier(50, {
        supported: false,
        deviceType: "desktop",
        isMobile: false,
        webGpuAvailable: false,
      })
    ).toBe("unsupported");

    // Basic: < 15 tokens/sec
    expect(determineHardwareTier(8.5)).toBe("basic");
    expect(determineHardwareTier(14.9)).toBe("basic");

    // Standard: 15 <= speed < 30 tokens/sec
    expect(determineHardwareTier(15.0)).toBe("standard");
    expect(determineHardwareTier(25.4)).toBe("standard");
    expect(determineHardwareTier(29.9)).toBe("standard");

    // Advanced: >= 30 tokens/sec
    expect(determineHardwareTier(30.0)).toBe("advanced");
    expect(determineHardwareTier(45.2)).toBe("advanced");
  });

  // Acceptance Criterion: "Recommendation changes with measured speed in tests using a mocked runtime"
  it("changes recommendation dynamically with measured speed in tests using a mocked runtime", async () => {
    // 1. Slow runtime (< 15 tps) -> Basic tier
    const slowRuntime: HardwareRuntime = {
      hasWebGpu: () => true,
      isMobileDevice: () => false,
      runComputeBenchmark: async () => ({
        tokensPerSecond: 11.2,
        latencyMs: 150,
      }),
    };

    const slowResult = await runHardwareBenchmark(slowRuntime);
    expect(slowResult.tokensPerSecond).toBe(11.2);
    expect(slowResult.tier).toBe("basic");
    expect(slowResult.recommendedModelTierLabel).toBe(TIER_LABELS.basic);
    expect(slowResult.recommendedModels).toEqual(RECOMMENDED_MODELS_BY_TIER.basic);
    expect(slowResult.recommendedModels[0]).toContain("1.7B");

    // 2. Medium runtime (15-30 tps) -> Standard tier
    const standardRuntime: HardwareRuntime = {
      hasWebGpu: () => true,
      isMobileDevice: () => false,
      runComputeBenchmark: async () => ({
        tokensPerSecond: 24.5,
        latencyMs: 120,
      }),
    };

    const standardResult = await runHardwareBenchmark(standardRuntime);
    expect(standardResult.tokensPerSecond).toBe(24.5);
    expect(standardResult.tier).toBe("standard");
    expect(standardResult.recommendedModelTierLabel).toBe(TIER_LABELS.standard);
    expect(standardResult.recommendedModels).toEqual(RECOMMENDED_MODELS_BY_TIER.standard);
    expect(standardResult.recommendedModels[0]).toContain("3B");

    // 3. Fast runtime (>= 30 tps) -> Advanced tier
    const fastRuntime: HardwareRuntime = {
      hasWebGpu: () => true,
      isMobileDevice: () => false,
      runComputeBenchmark: async () => ({
        tokensPerSecond: 42.0,
        latencyMs: 80,
      }),
    };

    const fastResult = await runHardwareBenchmark(fastRuntime);
    expect(fastResult.tokensPerSecond).toBe(42.0);
    expect(fastResult.tier).toBe("advanced");
    expect(fastResult.recommendedModelTierLabel).toBe(TIER_LABELS.advanced);
    expect(fastResult.recommendedModels).toEqual(RECOMMENDED_MODELS_BY_TIER.advanced);
    expect(fastResult.recommendedModels[0]).toContain("8B");

    // Verify recommendations are measurably distinct
    expect(slowResult.tier).not.toEqual(standardResult.tier);
    expect(standardResult.tier).not.toEqual(fastResult.tier);
  });

  it("handles benchmark on unsupported hardware safely without executing compute", async () => {
    const unsupportedRuntime: HardwareRuntime = {
      hasWebGpu: () => false,
      isMobileDevice: () => false,
    };

    const result = await runHardwareBenchmark(unsupportedRuntime);

    expect(result.tokensPerSecond).toBe(0);
    expect(result.tier).toBe("unsupported");
    expect(result.recommendedModels).toHaveLength(0);
    expect(result.notes[0]).toContain("WebGPU is not supported");
  });

  describe("Device Rules Enforcement (M3.5, FR-022, ADR-013)", () => {
    it("identifies phone devices via runtime and navigator", () => {
      const mobileRuntime: HardwareRuntime = {
        hasWebGpu: () => true,
        isMobileDevice: () => true,
      };
      const desktopRuntime: HardwareRuntime = {
        hasWebGpu: () => true,
        isMobileDevice: () => false,
      };

      expect(isPhoneDevice(mobileRuntime)).toBe(true);
      expect(isPhoneDevice(desktopRuntime)).toBe(false);
    });

    it("blocks local mode on phones with clear explanation", () => {
      const mobileRuntime: HardwareRuntime = {
        hasWebGpu: () => true,
        isMobileDevice: () => true,
      };

      const result = validateDeviceRules({
        isLocalModel: true,
        inputMode: "text",
        runtime: mobileRuntime,
      });

      expect(result.valid).toBe(false);
      expect(result.isMobile).toBe(true);
      expect(result.enforcedInputMode).toBe("text");
      expect(result.error).toContain("Local models are disabled on mobile devices (phones/tablets)");
    });

    it("enforces text-only mode for local models on PC when voice is attempted", () => {
      const desktopRuntime: HardwareRuntime = {
        hasWebGpu: () => true,
        isMobileDevice: () => false,
      };

      const result = validateDeviceRules({
        isLocalModel: true,
        inputMode: "voice",
        runtime: desktopRuntime,
      });

      expect(result.valid).toBe(false);
      expect(result.isMobile).toBe(false);
      expect(result.enforcedInputMode).toBe("text");
      expect(result.error).toContain("Local mode is text-only. Voice input and output are disabled");
    });

    it("allows valid text-only local model on PC", () => {
      const desktopRuntime: HardwareRuntime = {
        hasWebGpu: () => true,
        isMobileDevice: () => false,
      };

      const result = validateDeviceRules({
        isLocalModel: true,
        inputMode: "text",
        runtime: desktopRuntime,
      });

      expect(result.valid).toBe(true);
      expect(result.isMobile).toBe(false);
      expect(result.enforcedInputMode).toBe("text");
      expect(result.error).toBeUndefined();
    });

    it("allows voice mode for cloud models on supported devices", () => {
      const desktopRuntime: HardwareRuntime = {
        hasWebGpu: () => false,
        isMobileDevice: () => false,
      };

      const result = validateDeviceRules({
        isLocalModel: false,
        inputMode: "voice",
        runtime: desktopRuntime,
      });

      expect(result.valid).toBe(true);
      expect(result.enforcedInputMode).toBe("voice");
      expect(result.error).toBeUndefined();
    });
  });
});

