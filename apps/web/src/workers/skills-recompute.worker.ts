// FR-014, architecture.md 6.4: Off-main-thread Web Worker for deterministic skill statistics recomputation.
import { recomputeSkillStats, type SessionRow, type TurnRow } from "@abhyas/core";
import { CANONICAL_SKILL_IDS, TAXONOMY_VERSION } from "@abhyas/content";

self.onmessage = (e: MessageEvent) => {
  const { id, turns, sessions, options } = e.data as {
    id: string;
    turns: TurnRow[];
    sessions?: SessionRow[];
    options?: {
      taxonomyVersion?: number;
      recencyHalfLife?: number;
    };
  };

  try {
    const stats = recomputeSkillStats(turns, sessions ?? [], {
      taxonomyVersion: options?.taxonomyVersion ?? TAXONOMY_VERSION,
      recencyHalfLife: options?.recencyHalfLife,
      knownSkillIds: CANONICAL_SKILL_IDS,
    });

    self.postMessage({ id, ok: true, stats });
  } catch (err: unknown) {
    self.postMessage({
      id,
      ok: false,
      error: err instanceof Error ? err.message : "Failed to recompute skill stats in worker",
    });
  }
};
