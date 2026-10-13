// FR-001, ADR-004: Migration and schema validation test against fixture v1.
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { AbhyasDatabase } from "./dexie-schema";
import v1Fixture from "./fixtures/v1-fixture.json";
import { MigrationHarness } from "./migration-harness";

describe("M0.3: Storage & Migration Harness", () => {
  let db: AbhyasDatabase;

  beforeEach(async () => {
    db = new AbhyasDatabase(`TestDB_${Date.now()}_${Math.random()}`);
    await db.open();
  });

  it("imports fixture v1 and stores records into Dexie v1 tables", async () => {
    await MigrationHarness.importFixture(db, v1Fixture);

    const profiles = await db.profile.toArray();
    expect(profiles.length).toBe(2);

    const docs = await db.documents.toArray();
    expect(docs.length).toBe(1);
    expect(docs[0]?.hash).toBe("a1b2c3d4e5f6");

    const settings = await db.settings.toArray();
    expect(settings.length).toBe(1);
    expect(settings[0]?.key).toBe("theme");
    expect(settings[0]?.value).toBe("ink");
  });

  it("validates records, quarantines invalid rows, and leaves valid rows intact", async () => {
    await MigrationHarness.importFixture(db, v1Fixture);

    const result = await MigrationHarness.runFullValidation(db);
    expect(result.migratedCount).toBe(2); // prof_001 and doc_001
    expect(result.quarantinedCount).toBe(1); // prof_invalid_002

    // Check valid profile exists
    const validProfile = await db.profile.get("prof_001");
    expect(validProfile).toBeDefined();
    expect(validProfile?.level).toBe("junior");

    // Check invalid profile was removed from profile table
    const invalidProfile = await db.profile.get("prof_invalid_002");
    expect(invalidProfile).toBeUndefined();

    // Check quarantine table contains the invalid record
    const quarantineRecords = await db.quarantine.toArray();
    expect(quarantineRecords.length).toBe(1);
    expect(quarantineRecords[0]?.table).toBe("profile");
    expect(quarantineRecords[0]?.error).toBeDefined();
    expect((quarantineRecords[0]?.raw as { id: string }).id).toBe("prof_invalid_002");
  });
});
