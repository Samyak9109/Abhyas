// FR-023, ADR-013, phases.md M3.3: Unit tests for curated models catalog.
import { describe, it, expect } from "vitest";
import {
  CURATED_CATALOG,
  CURATED_MODELS,
  MODELS_CATALOG_VERSION,
  getCuratedModel,
  getCuratedModelsForTier,
} from "./models.js";
import { validateCuratedModelsCatalog } from "./validator.js";

describe("Curated Models Catalog (M3.3, FR-023)", () => {
  it("provides a versioned catalog with between 3 and 5 models", () => {
    expect(MODELS_CATALOG_VERSION).toBeGreaterThanOrEqual(1);
    expect(CURATED_CATALOG.version).toBe(MODELS_CATALOG_VERSION);
    expect(CURATED_CATALOG.models.length).toBeGreaterThanOrEqual(3);
    expect(CURATED_CATALOG.models.length).toBeLessThanOrEqual(5);
    expect(CURATED_MODELS.length).toBe(CURATED_CATALOG.models.length);
  });

  it("validates successfully with validateCuratedModelsCatalog", () => {
    const validated = validateCuratedModelsCatalog(CURATED_CATALOG);
    expect(validated.models.length).toBe(CURATED_CATALOG.models.length);
  });

  it("ensures each listed model passes the sanity test on at least one reference device (acceptance criteria)", () => {
    for (const model of CURATED_MODELS) {
      expect(model.id).toBeTruthy();
      expect(model.name).toBeTruthy();
      expect(model.engine).toBe("webllm");
      expect(model.repository).toBeTruthy();
      expect(model.sizeBytes).toBeGreaterThan(0);
      expect(model.contextLength).toBeGreaterThanOrEqual(2048);
      expect(["safetensors", "gguf", "onnx"]).toContain(model.format);
      expect(model.notes).toBeTruthy();

      // Measured speed
      expect(model.measuredSpeed.tokensPerSecond).toBeGreaterThan(0);
      expect(model.measuredSpeed.latencyMs).toBeGreaterThan(0);
      expect(model.measuredSpeed.referenceDevice).toBeTruthy();

      // Sanity result
      expect(model.sanityResult.status).toBe("interview-ready");
      expect(model.sanityResult.speedPassed).toBe(true);
      expect(model.sanityResult.jsonValid).toBe(true);
      expect(model.sanityResult.instructionFollowing).toBe(true);
      expect(model.sanityResult.referenceDevice).toBeTruthy();
    }
  });

  it("looks up models by id", () => {
    const smol = getCuratedModel("SmolLM2-1.7B-Instruct-q4f16_1-MLC");
    expect(smol).toBeDefined();
    expect(smol?.name).toBe("SmolLM2 1.7B Instruct");

    const nonExistent = getCuratedModel("non-existent-model");
    expect(nonExistent).toBeUndefined();
  });

  it("filters models correctly by hardware tier", () => {
    const unsupported = getCuratedModelsForTier("unsupported");
    expect(unsupported).toHaveLength(0);

    const basic = getCuratedModelsForTier("basic");
    expect(basic.length).toBeGreaterThan(0);
    expect(basic.every((m) => m.minimumTier === "basic")).toBe(true);

    const standard = getCuratedModelsForTier("standard");
    expect(standard.length).toBeGreaterThan(basic.length);
    expect(standard.every((m) => m.minimumTier === "basic" || m.minimumTier === "standard")).toBe(
      true
    );

    const advanced = getCuratedModelsForTier("advanced");
    expect(advanced).toHaveLength(CURATED_MODELS.length);
  });
});
