// FR-001, ADR-004: Migration and schema validation harness with quarantine routing.
import type { ZodType } from "zod";
import { IngestedDocumentSchema, ProfileSchema } from "../schemas";
import type { AbhyasDatabase } from "./dexie-schema";
import { rowKeyOf } from "./table-registry.js";

export interface MigrationResult {
  migratedCount: number;
  quarantinedCount: number;
}

export class MigrationHarness {
  /**
   * Imports a raw fixture containing table records into the database.
   */
  static async importFixture(
    db: AbhyasDatabase,
    fixture: Record<string, unknown[]>
  ): Promise<void> {
    await db.transaction("rw", db.tables, async () => {
      for (const [tableName, records] of Object.entries(fixture)) {
        const table = db.table(tableName);
        if (table && Array.isArray(records)) {
          await table.bulkPut(records);
        }
      }
    });
  }

  /**
   * Validates all records in the specified table against a Zod schema.
   * Invalid records are removed from the table and routed to the quarantine table.
   */
  static async validateTable<T>(
    db: AbhyasDatabase,
    tableName: string,
    schema: ZodType<T>
  ): Promise<MigrationResult> {
    const table = db.table(tableName);
    if (!table) throw new Error(`Table ${tableName} does not exist`);

    const records = await table.toArray();
    let migratedCount = 0;
    let quarantinedCount = 0;

    for (const record of records) {
      const parsed = schema.safeParse(record);
      if (!parsed.success) {
        // Quarantine invalid record
        await db.quarantine.put({
          id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          table: tableName,
          raw: record,
          error: parsed.error.message,
          at: new Date().toISOString(),
        });
        // Remove from primary table
        const key = rowKeyOf(record);

        if (key) {
          await table.delete(key);
        }
        quarantinedCount++;
      } else {
        migratedCount++;
      }
    }

    return { migratedCount, quarantinedCount };
  }

  /**
   * Runs validation across all core tables that have strict schemas.
   */
  static async runFullValidation(db: AbhyasDatabase): Promise<MigrationResult> {
    let totalMigrated = 0;
    let totalQuarantined = 0;

    const profileRes = await this.validateTable(db, "profile", ProfileSchema);
    totalMigrated += profileRes.migratedCount;
    totalQuarantined += profileRes.quarantinedCount;

    const docsRes = await this.validateTable(db, "documents", IngestedDocumentSchema);
    totalMigrated += docsRes.migratedCount;
    totalQuarantined += docsRes.quarantinedCount;

    return {
      migratedCount: totalMigrated,
      quarantinedCount: totalQuarantined,
    };
  }
}
