// FR-022, FR-023, ADR-013: Unit tests for local engine frontend service.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStorageAdapter } from "@abhyas/core";
import {
  createWorkerBridge,
  getInstalledModels,
  getLocalEngineAdapter,
  getStorageQuotaReport,
  recordModelStatus,
  recordModelSanityResult,
  removeModelRecord,
  requestPersistentStorage,
  runSanityTestOnLoadedModel,
} from "./local-engine";

describe("Local Engine Service (FR-022, FR-023)", () => {
  let storage: MemoryStorageAdapter;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
  });

  it("records model status and lists installed models", async () => {
    const initial = await getInstalledModels(storage);
    expect(initial).toEqual([]);

    await recordModelStatus(
      storage,
      "SmolLM2-1.7B-Instruct-q4f16_1-MLC",
      "downloading",
      1_050_000_000
    );
    const inProgress = await getInstalledModels(storage);
    expect(inProgress).toHaveLength(1);
    expect(inProgress[0]?.id).toBe("SmolLM2-1.7B-Instruct-q4f16_1-MLC");
    expect(inProgress[0]?.status).toBe("downloading");

    await recordModelStatus(storage, "SmolLM2-1.7B-Instruct-q4f16_1-MLC", "ready");
    const ready = await getInstalledModels(storage);
    expect(ready[0]?.status).toBe("ready");

    await removeModelRecord(storage, "SmolLM2-1.7B-Instruct-q4f16_1-MLC");
    const afterDelete = await getInstalledModels(storage);
    expect(afterDelete).toEqual([]);
  });

  it("calculates storage quota and detects nearly full status", async () => {
    // Mock navigator.storage
    const originalNavigator = globalThis.navigator;
    const mockStorage = {
      estimate: vi.fn().mockResolvedValue({
        usage: 45 * 1024 * 1024 * 1024,
        quota: 50 * 1024 * 1024 * 1024,
      }),
      persisted: vi.fn().mockResolvedValue(false),
      persist: vi.fn().mockResolvedValue(true),
    };

    Object.defineProperty(globalThis, "navigator", {
      value: { ...originalNavigator, storage: mockStorage },
      writable: true,
      configurable: true,
    });

    const report = await getStorageQuotaReport();
    expect(report.usageMb).toBeGreaterThan(0);
    expect(report.percentage).toBe(90);
    expect(report.isNearlyFull).toBe(true);
    expect(report.persisted).toBe(false);

    const persistGranted = await requestPersistentStorage();
    expect(persistGranted).toBe(true);
    expect(mockStorage.persist).toHaveBeenCalled();

    // Restore
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it("provides LocalEngineAdapter singleton and simulation bridge", async () => {
    const bridge = createWorkerBridge();
    const adapter = getLocalEngineAdapter(bridge);
    expect(adapter).toBeDefined();
    expect(adapter.id).toBe("webllm");

    const loadRes = await adapter.loadModel("SmolLM2-1.7B-Instruct-q4f16_1-MLC");
    expect(loadRes.ok).toBe(true);
    expect(adapter.isModelLoaded()).toBe(true);

    const unloadRes = await adapter.unloadModel();
    expect(unloadRes.ok).toBe(true);
    expect(adapter.isModelLoaded()).toBe(false);
  });

  it("records sanity results and runs sanity tests on loaded models (FR-023, AI-006)", async () => {
    const bridge = createWorkerBridge();
    const adapter = getLocalEngineAdapter(bridge);

    await recordModelSanityResult(storage, "SmolLM2-1.7B-Instruct-q4f16_1-MLC", {
      status: "interview-ready",
      tokensPerSecond: 28.5,
      speedPassed: true,
      jsonValid: true,
      instructionFollowing: true,
      testedAt: "2026-10-18T00:00:00.000Z",
      referenceDevice: "Local Test Device",
    });

    const installed = await getInstalledModels(storage);
    expect(installed[0]?.sanityResult?.status).toBe("interview-ready");
    expect(installed[0]?.sanityResult?.tokensPerSecond).toBe(28.5);

    await adapter.loadModel("SmolLM2-1.7B-Instruct-q4f16_1-MLC");
    const sanityResult = await runSanityTestOnLoadedModel(
      adapter,
      "SmolLM2-1.7B-Instruct-q4f16_1-MLC",
      storage,
      {
        thresholds: { minInterviewTps: 1, minQuestionsTps: 0.5 },
        deviceLabel: "Test Device",
      }
    );

    expect(sanityResult).toBeDefined();
    expect(sanityResult.testedAt).toBeTruthy();
  });
});
