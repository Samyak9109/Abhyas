// FR-023, ADR-013, architecture.md Section 12: Curated in-browser models catalog.
import modelsData from "../models.json" with { type: "json" };
import type { HardwareTier, CuratedModel, CuratedCatalog, CuratedModelSpeed } from "@abhyas/core";

export type { CuratedModel, CuratedCatalog, CuratedModelSpeed };

export const CURATED_CATALOG: CuratedCatalog = modelsData as unknown as CuratedCatalog;

export const MODELS_CATALOG_VERSION = CURATED_CATALOG.version;

export const CURATED_MODELS: readonly CuratedModel[] = CURATED_CATALOG.models;

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
