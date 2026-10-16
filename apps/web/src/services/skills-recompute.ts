// FR-014, architecture.md 14: Skill statistics recomputation service with Web Worker execution and storage persistence.
import {
  recomputeSkillStats,
  selectWeakestSkill,
  selectStrongestSkill,
  type RecomputeOptions,
  type SessionRow,
  type SkillStatRow,
  type StorageAdapter,
  type TurnRow,
} from "@abhyas/core";
import { CANONICAL_SKILL_IDS, TAXONOMY_VERSION } from "@abhyas/content";

export interface SkillStatsSummary {
  stats: SkillStatRow[];
  weakestSkillId?: string | undefined;
  strongestSkillId?: string | undefined;
}

/**
 * Recomputes skill statistics using an off-main-thread Web Worker if supported by the browser,
 * or falls back synchronously to the pure core engine.
 */
export async function recomputeSkillStatsAsync(
  turns: TurnRow[],
  sessions: SessionRow[] = [],
  options: RecomputeOptions = {}
): Promise<SkillStatRow[]> {
  const isTestEnv =
    typeof process !== "undefined" &&
    (process.env.NODE_ENV === "test" || process.env.VITEST === "true");

  if (!isTestEnv && typeof Worker !== "undefined" && typeof window !== "undefined") {
    try {
      return await recomputeViaWorker(turns, sessions, options);
    } catch {
      // Fall back to direct recompute if worker initialization fails
    }
  }

  return recomputeSkillStats(turns, sessions, {
    taxonomyVersion: options.taxonomyVersion ?? TAXONOMY_VERSION,
    recencyHalfLife: options.recencyHalfLife,
    knownSkillIds: options.knownSkillIds ?? CANONICAL_SKILL_IDS,
    deliverySkillIds: options.deliverySkillIds,
  });
}

function recomputeViaWorker(
  turns: TurnRow[],
  sessions: SessionRow[],
  options: RecomputeOptions
): Promise<SkillStatRow[]> {
  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(new URL("../workers/skills-recompute.worker.ts", import.meta.url), {
        type: "module",
      });

      const messageId = Math.random().toString(36).substring(2);

      const timer = setTimeout(() => {
        worker.terminate();
        reject(new Error("Skill stats recompute timed out in worker"));
      }, 10000);

      worker.onmessage = (e: MessageEvent) => {
        if (e.data.id === messageId) {
          clearTimeout(timer);
          worker.terminate();
          if (e.data.ok) {
            resolve(e.data.stats as SkillStatRow[]);
          } else {
            reject(new Error(e.data.error || "Failed to recompute skill stats in worker"));
          }
        }
      };

      worker.onerror = (err) => {
        clearTimeout(timer);
        worker.terminate();
        reject(err);
      };

      worker.postMessage({
        id: messageId,
        turns,
        sessions,
        options: {
          taxonomyVersion: options.taxonomyVersion ?? TAXONOMY_VERSION,
          recencyHalfLife: options.recencyHalfLife,
        },
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Recomputes skill statistics from stored turns & sessions and persists them to the skillStats table in storage.
 * Reproduces stored statistics deterministically.
 */
export async function recomputeAndStoreSkillStats(
  storage: StorageAdapter,
  options: RecomputeOptions = {}
): Promise<SkillStatRow[]> {
  const [turns, sessions] = await Promise.all([
    storage.getAll<TurnRow>("turns"),
    storage.getAll<SessionRow>("sessions"),
  ]);

  const stats = await recomputeSkillStatsAsync(turns, sessions, options);

  // Clear existing skill stats and save newly recomputed ones
  await storage.clear("skillStats");
  for (const stat of stats) {
    await storage.put("skillStats", stat);
  }

  return stats;
}

/**
 * Loads stored skill statistics from storage and returns summary metrics including
 * weakest and strongest skills with confidence thresholds applied.
 */
export async function getSkillStatsSummary(storage: StorageAdapter): Promise<SkillStatsSummary> {
  const stats = await storage.getAll<SkillStatRow>("skillStats");
  const knownIds = Array.from(CANONICAL_SKILL_IDS);

  const weakestSkillId = selectWeakestSkill(stats, knownIds);
  const strongestSkillId = selectStrongestSkill(stats);

  return {
    stats,
    weakestSkillId,
    strongestSkillId,
  };
}
