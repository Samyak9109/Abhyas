// FR-023, ADR-017: Model format validation, safety checks, and storage formatting.
import type { ModelFormat, ModelFormatValidation } from "./types.js";

export const ALLOWED_MODEL_FORMATS: readonly ModelFormat[] = ["safetensors", "gguf", "onnx"];

export const DISALLOWED_MODEL_FORMATS: readonly string[] = [
  "pkl",
  "pickle",
  "bin",
  "pt",
  "pth",
  "ckpt",
];

/**
 * Validates model file format against the safe allowlist (ADR-017, FR-023).
 * Rejects pickle-based execution formats to prevent arbitrary code execution vulnerabilities.
 */
export function validateModelFormat(filenameOrUrl: string): ModelFormatValidation {
  const clean = filenameOrUrl.trim().toLowerCase();
  if (!clean) {
    return { valid: false, error: "Model identifier or file path cannot be empty." };
  }

  // Remove URL query params / hashes if any
  const pathname = clean.split("?")[0]?.split("#")[0] ?? clean;

  // 1. Check for dangerous pickle-based extensions
  for (const dangerous of DISALLOWED_MODEL_FORMATS) {
    if (pathname.endsWith(`.${dangerous}`)) {
      return {
        valid: false,
        error: `Unsafe format ".${dangerous}" is prohibited. Abhyas blocks pickle-based model formats to prevent arbitrary code execution (ADR-017). Use .safetensors, .gguf, or .onnx.`,
      };
    }
  }

  // 2. Check for approved formats
  for (const allowed of ALLOWED_MODEL_FORMATS) {
    if (
      pathname.endsWith(`.${allowed}`) ||
      pathname.includes(`-${allowed}`) ||
      pathname.includes(`_${allowed}`)
    ) {
      return { valid: true, format: allowed };
    }
  }

  // If identifier is a HuggingFace repo (e.g. "org/repo-safetensors" or contains MLC)
  if (clean.includes("safetensors") || clean.includes("mlc")) {
    return { valid: true, format: "safetensors" };
  }
  if (clean.includes("gguf")) {
    return { valid: true, format: "gguf" };
  }
  if (clean.includes("onnx")) {
    return { valid: true, format: "onnx" };
  }

  return {
    valid: false,
    error:
      "Unsupported format. Please provide a verified safe format: .safetensors, .gguf, or .onnx (ADR-017).",
  };
}

/**
 * Formats a byte count into a human-readable string (MB or GB).
 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Calculates storage percentage and whether it exceeds the nearly full threshold (80%).
 */
export function calculateStorageQuotaStatus(
  usageBytes: number,
  quotaBytes: number,
  thresholdPercent = 80
): { percentage: number; isNearlyFull: boolean } {
  if (quotaBytes <= 0) {
    return { percentage: 0, isNearlyFull: false };
  }
  const percentage = Math.min(100, Math.round((usageBytes / quotaBytes) * 1000) / 10);
  const isNearlyFull = percentage >= thresholdPercent;
  return { percentage, isNearlyFull };
}
