// FR-020: Versioned export file. Exports exclude provider keys by default and the
// quarantine table (corrupt rows are local forensics, not backup material).
import { z } from "zod";
import {
  CompanyCacheRowSchema,
  DocumentRowSchema,
  ModelRowSchema,
  ProfileRowSchema,
  ProviderRowSchema,
  ReviewQueueRowSchema,
  SessionRowSchema,
  SettingRowSchema,
  SkillStatRowSchema,
  StructuredProfileRowSchema,
  TurnRowSchema,
} from "../schemas";
import type { StorageAdapter } from "./storage-interface";

export const EXPORT_SCHEMA_VERSION = 1;

export const EXPORT_TABLES = [
  "profile",
  "documents",
  "structuredProfiles",
  "providers",
  "sessions",
  "turns",
  "skillStats",
  "reviewQueue",
  "settings",
  "companyCache",
  "models",
] as const;

export type ExportTable = (typeof EXPORT_TABLES)[number];

export const ExportFileSchema = z.object({
  schemaVersion: z.number().int().min(1),
  app: z.literal("abhyas"),
  exportedAt: z.string().datetime(),
  tables: z.object({
    profile: z.array(ProfileRowSchema),
    documents: z.array(DocumentRowSchema),
    structuredProfiles: z.array(StructuredProfileRowSchema),
    providers: z.array(ProviderRowSchema),
    sessions: z.array(SessionRowSchema),
    turns: z.array(TurnRowSchema),
    skillStats: z.array(SkillStatRowSchema),
    reviewQueue: z.array(ReviewQueueRowSchema),
    settings: z.array(SettingRowSchema),
    companyCache: z.array(CompanyCacheRowSchema),
    models: z.array(ModelRowSchema),
  }),
});
export type ExportFile = z.infer<typeof ExportFileSchema>;

export interface BuildExportOptions {
  includeKeys?: boolean;
  now?: Date;
}

export async function buildExport(
  storage: StorageAdapter,
  options: BuildExportOptions = {}
): Promise<ExportFile> {
  const tables = {} as Record<ExportTable, unknown[]>;
  for (const table of EXPORT_TABLES) {
    tables[table] = await storage.getAll(table);
  }
  if (!options.includeKeys) {
    tables.providers = (tables.providers as Record<string, unknown>[]).map(
      ({ key: _key, encryptedKey: _encryptedKey, ...rest }) => rest
    );
  }
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    app: "abhyas",
    exportedAt: (options.now ?? new Date()).toISOString(),
    tables: tables as ExportFile["tables"],
  };
}

export type ExportParseError = "invalid_json" | "invalid_schema" | "unsupported_version";
export type ExportParseResult =
  | { ok: true; data: ExportFile }
  | { ok: false; error: ExportParseError };

export function parseExport(raw: string): ExportParseResult {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: "invalid_json" };
  }

  const version = (json as { schemaVersion?: unknown })?.schemaVersion;
  if (typeof version === "number" && version > EXPORT_SCHEMA_VERSION) {
    return { ok: false, error: "unsupported_version" };
  }

  const parsed = ExportFileSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, error: "invalid_schema" };
  }
  return { ok: true, data: parsed.data };
}
