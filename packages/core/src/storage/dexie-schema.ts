// FR-001, ADR-004: Dexie IndexedDB Schema v1 for local-first storage.
// Row types come from the Zod schemas (schemas/storage-rows.schema.ts) so there
// is a single source of truth for what a valid row looks like.
import Dexie, { type Table } from "dexie";
import type {
  CompanyCacheRow,
  DocumentRow,
  ModelRow,
  ProfileRow,
  ProviderRow,
  QuarantineRow,
  ReviewQueueRow,
  SessionRow,
  SettingRow,
  SkillStatRow,
  StructuredProfileRow,
  TurnRow,
} from "../schemas";

export type {
  CompanyCacheRow,
  DocumentRow,
  ModelRow,
  ProfileRow,
  ProviderRow,
  QuarantineRow,
  ReviewQueueRow,
  SessionRow,
  SettingRow,
  SkillStatRow,
  StructuredProfileRow,
  TurnRow,
} from "../schemas";

export class AbhyasDatabase extends Dexie {
  profile!: Table<ProfileRow, string>;
  documents!: Table<DocumentRow, string>;
  structuredProfiles!: Table<StructuredProfileRow, string>;
  providers!: Table<ProviderRow, string>;
  sessions!: Table<SessionRow, string>;
  turns!: Table<TurnRow, string>;
  skillStats!: Table<SkillStatRow, string>;
  reviewQueue!: Table<ReviewQueueRow, string>;
  settings!: Table<SettingRow, string>;
  companyCache!: Table<CompanyCacheRow, string>;
  models!: Table<ModelRow, string>;
  quarantine!: Table<QuarantineRow, string>;

  constructor(dbName = "AbhyasDB") {
    super(dbName);

    // Schema v1 definition
    this.version(1).stores({
      profile: "id, updatedAt",
      documents: "id, kind, hash, updatedAt",
      structuredProfiles: "id, inputHash",
      providers: "id, kind",
      sessions: "id, status, startedAt, providerId, schemaVersion",
      turns: "id, sessionId, [sessionId+index], questionId, status",
      skillStats: "skillId, lastPracticedAt",
      reviewQueue: "id, turnId, dueAt",
      settings: "key",
      companyCache: "slug, fetchedAt",
      models: "id, engine, status",
      quarantine: "id, table, at",
    });
  }
}
