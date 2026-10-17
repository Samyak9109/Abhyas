// FR-020, FR-019: Import validation, merge execution, and session deletion service.
import type { StorageAdapter } from "./storage-interface.js";
import {
  EXPORT_TABLES,
  type ExportFile,
  type ExportParseError,
  type ExportTable,
  parseExport,
} from "./export-format.js";
import { recomputeSkillStats } from "../skills/statistics.js";
import type { ReviewQueueRow, SessionRow, TurnRow } from "../schemas/storage-rows.schema.js";

export interface ImportValidationReport {
  valid: boolean;
  error?: ExportParseError;
  errorMessage?: string;
  exportedAt?: string;
  schemaVersion?: number;
  counts: Record<ExportTable, number>;
  summary: {
    sessionsCount: number;
    turnsCount: number;
    documentsCount: number;
    hasProfile: boolean;
    hasSettings: boolean;
  };
  conflicts: {
    duplicateSessions: number;
    newSessions: number;
  };
  data?: ExportFile;
}

export interface ImportResult {
  success: boolean;
  importedSessions: number;
  importedTurns: number;
  totalRecordsImported: number;
  recomputedSkillsCount: number;
}

export interface DeleteSessionResult {
  deletedSessionId: string;
  deletedTurnsCount: number;
  recomputedSkillsCount: number;
}

/**
 * Validates a raw backup JSON string and calculates counts, duplicates, and compatibility.
 */
export async function validateImport(
  raw: string,
  currentStorage?: StorageAdapter
): Promise<ImportValidationReport> {
  const parseResult = parseExport(raw);

  const emptyCounts: Record<ExportTable, number> = {
    profile: 0,
    documents: 0,
    structuredProfiles: 0,
    providers: 0,
    sessions: 0,
    turns: 0,
    skillStats: 0,
    reviewQueue: 0,
    settings: 0,
    companyCache: 0,
    models: 0,
  };

  if (!parseResult.ok) {
    let errorMessage = "Backup file could not be parsed.";
    if (parseResult.error === "invalid_json") {
      errorMessage = "The file is not valid JSON.";
    } else if (parseResult.error === "unsupported_version") {
      errorMessage = `This backup was created with a newer version of Abhyas. Please update your application before importing.`;
    } else if (parseResult.error === "invalid_schema") {
      errorMessage = "The backup file does not match the Abhyas backup schema.";
    }

    return {
      valid: false,
      error: parseResult.error,
      errorMessage,
      counts: emptyCounts,
      summary: {
        sessionsCount: 0,
        turnsCount: 0,
        documentsCount: 0,
        hasProfile: false,
        hasSettings: false,
      },
      conflicts: {
        duplicateSessions: 0,
        newSessions: 0,
      },
    };
  }

  const data = parseResult.data;
  const counts: Record<ExportTable, number> = {
    profile: data.tables.profile?.length ?? 0,
    documents: data.tables.documents?.length ?? 0,
    structuredProfiles: data.tables.structuredProfiles?.length ?? 0,
    providers: data.tables.providers?.length ?? 0,
    sessions: data.tables.sessions?.length ?? 0,
    turns: data.tables.turns?.length ?? 0,
    skillStats: data.tables.skillStats?.length ?? 0,
    reviewQueue: data.tables.reviewQueue?.length ?? 0,
    settings: data.tables.settings?.length ?? 0,
    companyCache: data.tables.companyCache?.length ?? 0,
    models: data.tables.models?.length ?? 0,
  };

  let duplicateSessions = 0;
  let newSessions = counts.sessions;

  if (currentStorage && counts.sessions > 0) {
    try {
      const existingSessions = await currentStorage.getAll<SessionRow>("sessions");
      const existingIds = new Set(existingSessions.map((s) => s.id));
      duplicateSessions = data.tables.sessions.filter((s) => existingIds.has(s.id)).length;
      newSessions = counts.sessions - duplicateSessions;
    } catch {
      // fallback if storage query fails
    }
  }

  return {
    valid: true,
    exportedAt: data.exportedAt,
    schemaVersion: data.schemaVersion,
    counts,
    summary: {
      sessionsCount: counts.sessions,
      turnsCount: counts.turns,
      documentsCount: counts.documents,
      hasProfile: counts.profile > 0 || counts.structuredProfiles > 0,
      hasSettings: counts.settings > 0,
    },
    conflicts: {
      duplicateSessions,
      newSessions,
    },
    data,
  };
}

/**
 * Executes import of validated backup data into storage and recalculates skill stats.
 */
export async function executeImport(
  storage: StorageAdapter,
  file: ExportFile,
  options: { mode?: "merge" | "replace" } = { mode: "merge" }
): Promise<ImportResult> {
  if (options.mode === "replace") {
    for (const table of EXPORT_TABLES) {
      await storage.clear(table);
    }
  }

  let totalRecordsImported = 0;

  for (const table of EXPORT_TABLES) {
    const rows = file.tables[table] || [];
    for (const record of rows) {
      await storage.put(table, record);
      totalRecordsImported++;
    }
  }

  // After importing sessions and turns, recompute skill statistics to keep consistency
  const [allTurns, allSessions] = await Promise.all([
    storage.getAll<TurnRow>("turns"),
    storage.getAll<SessionRow>("sessions"),
  ]);

  const recomputedStats = recomputeSkillStats(allTurns, allSessions);
  await storage.clear("skillStats");
  for (const stat of recomputedStats) {
    await storage.put("skillStats", stat);
  }

  return {
    success: true,
    importedSessions: file.tables.sessions.length,
    importedTurns: file.tables.turns.length,
    totalRecordsImported,
    recomputedSkillsCount: recomputedStats.length,
  };
}

/**
 * Deletes a single session, all its associated turns and review queue items, and updates skill statistics.
 */
export async function deleteSession(
  storage: StorageAdapter,
  sessionId: string
): Promise<DeleteSessionResult> {
  const [allTurns, allSessions, reviewQueue] = await Promise.all([
    storage.getAll<TurnRow>("turns"),
    storage.getAll<SessionRow>("sessions"),
    storage.getAll<ReviewQueueRow>("reviewQueue"),
  ]);

  const turnsToDelete = allTurns.filter((t) => t.sessionId === sessionId);
  const deletedTurnIds = new Set(turnsToDelete.map((t) => t.id));

  // 1. Delete matching turns
  for (const turn of turnsToDelete) {
    await storage.delete("turns", turn.id);
  }

  // 2. Delete review queue items referencing those turns
  for (const item of reviewQueue) {
    if (deletedTurnIds.has(item.turnId)) {
      await storage.delete("reviewQueue", item.id);
    }
  }

  // 3. Delete session row
  await storage.delete("sessions", sessionId);

  // 4. Recompute remaining skill stats
  const remainingTurns = allTurns.filter((t) => t.sessionId !== sessionId);
  const remainingSessions = allSessions.filter((s) => s.id !== sessionId);
  const recomputed = recomputeSkillStats(remainingTurns, remainingSessions);

  await storage.clear("skillStats");
  for (const stat of recomputed) {
    await storage.put("skillStats", stat);
  }

  return {
    deletedSessionId: sessionId,
    deletedTurnsCount: turnsToDelete.length,
    recomputedSkillsCount: recomputed.length,
  };
}
