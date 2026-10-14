// FR-001: Dexie adapter tests — persistence across reload, validate-on-read quarantine.
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import type { ProfileRow } from "../schemas";
import { DexieStorageAdapter } from "./dexie-storage";
import { AbhyasDatabase } from "./dexie-schema";

const VALID_PROFILE: ProfileRow = {
  id: "prof_1",
  level: "junior",
  targetRole: "Backend Engineer",
  updatedAt: "2026-10-14T00:00:00.000Z",
};

function freshDbName(): string {
  return `DexieAdapterTest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

describe("M1.1: DexieStorageAdapter", () => {
  let dbName: string;

  beforeEach(() => {
    dbName = freshDbName();
  });

  it("persists data across adapter instances (reload simulation)", async () => {
    const db = new AbhyasDatabase(dbName);
    await db.open();
    await new DexieStorageAdapter(db).put("profile", VALID_PROFILE);
    db.close();

    const reopened = new AbhyasDatabase(dbName);
    await reopened.open();
    const profile = await new DexieStorageAdapter(reopened).get<ProfileRow>("profile", "prof_1");
    expect(profile).toEqual(VALID_PROFILE);
    reopened.close();
  });

  it("quarantines a corrupt row on get instead of returning it", async () => {
    const db = new AbhyasDatabase(dbName);
    await db.open();
    await db.profile.put({ id: "prof_bad", level: "wizard", updatedAt: "not-a-date" } as never);

    const storage = new DexieStorageAdapter(db);
    expect(await storage.get("profile", "prof_bad")).toBeUndefined();

    const quarantined = await db.quarantine.toArray();
    expect(quarantined.length).toBe(1);
    expect(quarantined[0]?.table).toBe("profile");
    expect(quarantined[0]?.raw).toMatchObject({ id: "prof_bad" });
    // The corrupt row is removed from its source table, not silently kept.
    expect(await db.profile.toArray()).toEqual([]);
    db.close();
  });

  it("getAll returns only valid rows and quarantines the rest", async () => {
    const db = new AbhyasDatabase(dbName);
    await db.open();
    await db.profile.bulkPut([
      VALID_PROFILE,
      { id: "prof_bad", level: "wizard", updatedAt: "not-a-date" } as never,
    ]);

    const storage = new DexieStorageAdapter(db);
    const profiles = await storage.getAll<ProfileRow>("profile");
    expect(profiles).toEqual([VALID_PROFILE]);
    expect((await db.quarantine.toArray()).length).toBe(1);
    db.close();
  });

  it("clearAll empties every table", async () => {
    const db = new AbhyasDatabase(dbName);
    await db.open();
    const storage = new DexieStorageAdapter(db);
    await storage.put("profile", VALID_PROFILE);
    await storage.put("settings", { key: "theme", value: "paper" });
    await storage.put("sessions", {
      id: "s1",
      startedAt: "2026-10-14T00:00:00.000Z",
      status: "completed",
      plan: null,
      modality: "text",
      level: "junior",
      providerId: "gemini",
      modelId: "gemini-2.5-flash",
      schemaVersion: 1,
    });

    await storage.clearAll();
    expect(await db.profile.toArray()).toEqual([]);
    expect(await db.settings.toArray()).toEqual([]);
    expect(await db.sessions.toArray()).toEqual([]);
    db.close();
  });
});
