// FR-001, ADR-004: Dexie IndexedDB Schema v1 for local-first storage.
import Dexie, { type Table } from "dexie";
import type { Evaluation, ExperienceLevel } from "../schemas";

export interface ProfileRow {
  id: string;
  level: ExperienceLevel;
  targetRole: string;
  years?: number;
  updatedAt: string;
}

export interface DocumentRow {
  id: string;
  kind: "resume" | "jd";
  text: string;
  hash: string;
  updatedAt: string;
}

export interface StructuredProfileRow {
  id: string;
  inputHash: string;
  json: unknown;
  condensed: string;
  promptVersion: number;
}

export interface ProviderRow {
  id: string;
  kind: string;
  baseUrl?: string;
  modelRoles: {
    interviewer: string;
    evaluator: string;
  };
  key?: string;
  encryptedKey?: string;
  lastTestedAt?: string;
}

export interface SessionRow {
  id: string;
  startedAt: string;
  endedAt?: string;
  status: "active" | "completed" | "abandoned";
  plan: unknown;
  modality: "voice" | "text";
  level: ExperienceLevel;
  companySlug?: string;
  providerId: string;
  modelId: string;
  schemaVersion: number;
}

export interface TurnRow {
  id: string;
  sessionId: string;
  index: number;
  questionId?: string;
  isUnverifiedQuestion: boolean;
  skillTags: string[];
  difficulty: number;
  questionText: string;
  answerText: string;
  followUpOf?: string;
  evaluation?: Evaluation;
  delivery?: unknown;
  status: "scored" | "unscored";
}

export interface SkillStatRow {
  skillId: string;
  score: number;
  n: number;
  confidence: "low" | "medium" | "high";
  lastPracticedAt: string;
  trend?: number;
  taxonomyVersion: number;
}

export interface ReviewQueueRow {
  id: string;
  turnId: string;
  dueAt: string;
  intervalDays: number;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

export interface CompanyCacheRow {
  slug: string;
  pack: unknown;
  fetchedAt: string;
  packVersion: number;
}

export interface ModelRow {
  id: string;
  engine: string;
  sizeBytes: number;
  status: string;
  sanityResult?: unknown;
}

export interface QuarantineRow {
  id: string;
  table: string;
  raw: unknown;
  error: string;
  at: string;
}

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
