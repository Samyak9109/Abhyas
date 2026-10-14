// FR-001, ADR-004: Table registry joining Dexie table names to row schemas.
// Every persisted table is listed here; adapters validate reads through this map.
import type { ZodType } from "zod";
import {
  CompanyCacheRowSchema,
  DocumentRowSchema,
  ModelRowSchema,
  ProfileRowSchema,
  ProviderRowSchema,
  QuarantineRowSchema,
  ReviewQueueRowSchema,
  SessionRowSchema,
  SettingRowSchema,
  SkillStatRowSchema,
  StructuredProfileRowSchema,
  TurnRowSchema,
} from "../schemas";

export const STORAGE_TABLES = [
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
  "quarantine",
] as const;

export type StorageTable = (typeof STORAGE_TABLES)[number];

export const TABLE_SCHEMAS: Record<StorageTable, ZodType> = {
  profile: ProfileRowSchema,
  documents: DocumentRowSchema,
  structuredProfiles: StructuredProfileRowSchema,
  providers: ProviderRowSchema,
  sessions: SessionRowSchema,
  turns: TurnRowSchema,
  skillStats: SkillStatRowSchema,
  reviewQueue: ReviewQueueRowSchema,
  settings: SettingRowSchema,
  companyCache: CompanyCacheRowSchema,
  models: ModelRowSchema,
  quarantine: QuarantineRowSchema,
};

export function isStorageTable(name: string): name is StorageTable {
  return (STORAGE_TABLES as readonly string[]).includes(name);
}

// Tables whose rows use something other than `id` as their primary key.
export function rowKeyOf(record: unknown): string | undefined {
  const candidate = record as {
    id?: unknown;
    key?: unknown;
    slug?: unknown;
    skillId?: unknown;
  };
  for (const key of [candidate.id, candidate.key, candidate.slug, candidate.skillId]) {
    if (typeof key === "string" && key.length > 0) return key;
  }
  return undefined;
}
