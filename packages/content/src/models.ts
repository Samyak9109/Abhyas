// FR-023, ADR-013, architecture.md Section 12: Curated in-browser models.
import modelsData from "../models.json" with { type: "json" };
import type { HardwareTier } from "@abhyas/core";

export interface CuratedModel {
  id: string;
  name: string;
  engine: "webllm";
  repository: string;
  sizeBytes: number;
  minimumTier: Exclude<HardwareTier, "unsupported">;
  contextLength: number;
  format: "safetensors" | "gguf" | "onnx";
  notes: string;
}

export const CURATED_MODELS: readonly CuratedModel[] = modelsData as unknown as CuratedModel[];

export function getCuratedModel(id: string): CuratedModel | undefined {
  return CURATED_MODELS.find((m) => m.id === id);
}

export function getCuratedModelsForTier(tier: HardwareTier): CuratedModel[] {
  if (tier === "unsupported") return [];
  if (tier === "advanced") return [...CURATED_MODELS];
  if (tier === "standard") {
    return CURATED_MODELS.filter((m) => m.minimumTier === "basic" || m.minimumTier === "standard");
  }
  return CURATED_MODELS.filter((m) => m.minimumTier === "basic");
}
