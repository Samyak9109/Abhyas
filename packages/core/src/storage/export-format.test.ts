// FR-020: Export build/parse tests — round trip, key exclusion, version refusal.
import { describe, expect, it } from "vitest";
import type { StorageAdapter } from "./storage-interface";
import { MemoryStorageAdapter } from "./memory-storage";
import { buildExport, parseExport } from "./export-format";

const NOW = new Date("2026-10-14T12:00:00.000Z");

async function filledStorage(): Promise<StorageAdapter> {
  const storage = new MemoryStorageAdapter();
  await storage.put("profile", {
    id: "prof_1",
    level: "mid",
    targetRole: "Platform Engineer",
    updatedAt: "2026-10-14T00:00:00.000Z",
  });
  await storage.put("documents", {
    id: "doc_1",
    kind: "resume",
    text: "Experienced engineer...",
    hash: "abcdef123456",
    updatedAt: "2026-10-14T00:00:00.000Z",
  });
  await storage.put("providers", {
    id: "gemini",
    kind: "gemini",
    modelRoles: { interviewer: "m1", evaluator: "m2" },
    key: "SECRET_KEY_MATERIAL",
    lastTestedAt: "2026-10-14T00:00:00.000Z",
  });
  await storage.put("settings", { key: "theme", value: "ink" });
  await storage.put("sessions", {
    id: "s1",
    startedAt: "2026-10-14T00:00:00.000Z",
    status: "completed",
    plan: null,
    modality: "text",
    level: "mid",
    providerId: "gemini",
    modelId: "m1",
    schemaVersion: 1,
  });
  await storage.put("quarantine", {
    id: "q1",
    table: "profile",
    raw: { junk: true },
    error: "schema",
    at: "2026-10-14T00:00:00.000Z",
  });
  await storage.put("models", {
    id: "llama-3-8b",
    engine: "transformers",
    sizeBytes: 4000000000,
    status: "ready",
    gatedToken: "HF_GATED_SECRET_TOKEN",
  });
  return storage;
}

describe("M1.1: export format", () => {
  it("export then parse reproduces all stored data", async () => {
    const storage = await filledStorage();
    const exported = await buildExport(storage, { now: NOW });

    const parsed = parseExport(JSON.stringify(exported));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.tables.profile.length).toBe(1);
      expect(parsed.data.tables.documents.length).toBe(1);
      expect(parsed.data.tables.sessions.length).toBe(1);
      expect(parsed.data.tables.settings).toEqual([{ key: "theme", value: "ink" }]);
      expect(parsed.data.exportedAt).toBe(NOW.toISOString());
    }
  });

  it("excludes provider keys by default and includes them only on explicit opt-in", async () => {
    const storage = await filledStorage();

    const defaultExport = await buildExport(storage, { now: NOW });
    const provider = defaultExport.tables.providers[0] as Record<string, unknown>;
    expect(provider.key).toBeUndefined();
    expect(provider.encryptedKey).toBeUndefined();
    const model = defaultExport.tables.models[0] as Record<string, unknown>;
    expect(model.gatedToken).toBeUndefined();
    expect(provider.modelRoles).toEqual({ interviewer: "m1", evaluator: "m2" });

    const withKeys = await buildExport(storage, { includeKeys: true, now: NOW });
    const providerWithKey = withKeys.tables.providers[0] as Record<string, unknown>;
    expect(providerWithKey.key).toBe("SECRET_KEY_MATERIAL");
    const modelWithKey = withKeys.tables.models[0] as Record<string, unknown>;
    expect(modelWithKey.gatedToken).toBe("HF_GATED_SECRET_TOKEN");
  });

  it("never exports the quarantine table", async () => {
    const storage = await filledStorage();
    const exported = await buildExport(storage, { now: NOW });
    expect(JSON.stringify(exported)).not.toContain("q1");
    expect("quarantine" in exported.tables).toBe(false);
  });

  it("refuses a file from a newer schema version without touching content", () => {
    const future = { schemaVersion: 999, app: "abhyas", exportedAt: NOW.toISOString() };
    expect(parseExport(JSON.stringify(future))).toEqual({
      ok: false,
      error: "unsupported_version",
    });
  });

  it("refuses malformed JSON and schema-invalid files", () => {
    expect(parseExport("{ not json")).toEqual({ ok: false, error: "invalid_json" });
    expect(parseExport(JSON.stringify({ schemaVersion: 1, app: "other" }))).toEqual({
      ok: false,
      error: "invalid_schema",
    });
  });
});
