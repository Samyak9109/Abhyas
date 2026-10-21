// FR-023, ADR-017: Unit tests for local model format validation, safety checks, and storage formatting.
import { describe, expect, it } from "vitest";
import {
  ALLOWED_MODEL_FORMATS,
  DISALLOWED_MODEL_FORMATS,
  calculateStorageQuotaStatus,
  estimateHardwareFit,
  formatBytes,
  validateCustomModel,
  validateModelFormat,
} from "./models.js";

describe("Local Models Safety & Format Validation (ADR-017, FR-023)", () => {
  it("approves allowed safe model formats (.safetensors, .gguf, .onnx)", () => {
    for (const format of ALLOWED_MODEL_FORMATS) {
      const res = validateModelFormat(`model-weights.${format}`);
      expect(res.valid).toBe(true);
      expect(res.format).toBe(format);
      expect(res.error).toBeUndefined();
    }
  });

  it("approves Hugging Face repo identifiers with format in name", () => {
    const resSafetensors = validateModelFormat("meta-llama/Llama-3.2-3B-Instruct-safetensors");
    expect(resSafetensors.valid).toBe(true);
    expect(resSafetensors.format).toBe("safetensors");

    const resGguf = validateModelFormat("TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF");
    expect(resGguf.valid).toBe(true);
    expect(resGguf.format).toBe("gguf");

    const resOnnx = validateModelFormat("Xenova/Qwen2.5-0.5B-onnx");
    expect(resOnnx.valid).toBe(true);
    expect(resOnnx.format).toBe("onnx");
  });

  it("strictly rejects dangerous pickle-based model formats (.pkl, .bin, .pt, .pth, .ckpt)", () => {
    for (const dangerous of DISALLOWED_MODEL_FORMATS) {
      const res = validateModelFormat(`malicious-model.${dangerous}`);
      expect(res.valid).toBe(false);
      expect(res.error).toContain(`Unsafe format ".${dangerous}" is prohibited`);
      expect(res.error).toContain("ADR-017");
    }
  });

  it("rejects empty or unsupported model identifiers", () => {
    const emptyRes = validateModelFormat("");
    expect(emptyRes.valid).toBe(false);

    const unknownRes = validateModelFormat("custom-model.unknown");
    expect(unknownRes.valid).toBe(false);
    expect(unknownRes.error).toContain("Unsupported format");
  });

  it("validates custom models based on engine (WebLLM vs Ollama)", () => {
    // WebLLM engine format checks
    const validWebllm = validateCustomModel("my-org/custom-model.safetensors", "webllm");
    expect(validWebllm.valid).toBe(true);
    expect(validWebllm.format).toBe("safetensors");

    const invalidWebllm = validateCustomModel("dangerous.pt", "webllm");
    expect(invalidWebllm.valid).toBe(false);

    // Ollama engine tag checks
    const validOllama = validateCustomModel("llama3.2:3b", "ollama");
    expect(validOllama.valid).toBe(true);

    const whitespaceOllama = validateCustomModel("llama 3.2", "ollama");
    expect(whitespaceOllama.valid).toBe(false);
    expect(whitespaceOllama.error).toContain("whitespace");

    const invalidCharsOllama = validateCustomModel("llama; rm -rf", "ollama");
    expect(invalidCharsOllama.valid).toBe(false);
  });

  it("estimates hardware fit based on model size and device memory", () => {
    // 1.5 GB model on 8 GB device -> optimal
    const optimal = estimateHardwareFit(1.5 * 1024 * 1024 * 1024, 8);
    expect(optimal.fit).toBe("optimal");
    expect(optimal.message).toContain("Optimal fit");

    // 5 GB model on 8 GB device -> tight
    const tight = estimateHardwareFit(5 * 1024 * 1024 * 1024, 8);
    expect(tight.fit).toBe("tight");
    expect(tight.message).toContain("Tight fit");

    // 8 GB model on 8 GB device -> insufficient
    const insufficient = estimateHardwareFit(8 * 1024 * 1024 * 1024, 8);
    expect(insufficient.fit).toBe("insufficient");
    expect(insufficient.message).toContain("High memory demand");
  });
});

describe("Storage Formatting & Quota Calculations (FR-023)", () => {
  it("formats byte counts into human-readable strings", () => {
    expect(formatBytes(0)).toBe("0 MB");
    expect(formatBytes(512 * 1024)).toBe("512 KB");
    expect(formatBytes(500 * 1024 * 1024)).toBe("500.0 MB");
    expect(formatBytes(1.05 * 1024 * 1024 * 1024)).toBe("1.05 GB");
  });

  it("calculates storage quota percentage and warns when nearly full (>= 80%)", () => {
    const healthy = calculateStorageQuotaStatus(10 * 1024, 100 * 1024);
    expect(healthy.percentage).toBe(10);
    expect(healthy.isNearlyFull).toBe(false);

    const nearFull = calculateStorageQuotaStatus(85 * 1024, 100 * 1024);
    expect(nearFull.percentage).toBe(85);
    expect(nearFull.isNearlyFull).toBe(true);

    const zeroQuota = calculateStorageQuotaStatus(0, 0);
    expect(zeroQuota.percentage).toBe(0);
    expect(zeroQuota.isNearlyFull).toBe(false);
  });
});
