// FR-001, ADR-004: Dexie-backed StorageAdapter with validate-on-read.
// Corrupt rows are moved to the quarantine table and never silently dropped.
import type { AbhyasDatabase } from "./dexie-schema";
import type { StorageAdapter } from "./storage-interface";
import { TABLE_SCHEMAS, isStorageTable, rowKeyOf } from "./table-registry";

export class DexieStorageAdapter implements StorageAdapter {
  constructor(private db: AbhyasDatabase) {}

  async get<T>(tableName: string, key: string): Promise<T | undefined> {
    const table = this.db.table(tableName);
    if (!table) throw new Error(`Unknown table "${tableName}"`);
    const record = await table.get(key);
    if (record === undefined) return undefined;
    if (await this.quarantineIfInvalid(tableName, record)) return undefined;
    return record as T;
  }

  async put<T>(tableName: string, record: T): Promise<string> {
    const table = this.db.table(tableName);
    if (!table) throw new Error(`Unknown table "${tableName}"`);
    const key = rowKeyOf(record);
    if (key === undefined) {
      throw new Error(`Cannot store record in "${tableName}" without an id, key, slug or skillId`);
    }
    await table.put(record);
    return key;
  }

  async delete(tableName: string, key: string): Promise<void> {
    const table = this.db.table(tableName);
    if (!table) throw new Error(`Unknown table "${tableName}"`);
    await table.delete(key);
  }

  async getAll<T>(tableName: string): Promise<T[]> {
    const table = this.db.table(tableName);
    if (!table) throw new Error(`Unknown table "${tableName}"`);
    const records = (await table.toArray()) as T[];
    const valid: T[] = [];
    for (const record of records) {
      if (!(await this.quarantineIfInvalid(tableName, record))) {
        valid.push(record);
      }
    }
    return valid;
  }

  async clear(tableName: string): Promise<void> {
    const table = this.db.table(tableName);
    if (!table) throw new Error(`Unknown table "${tableName}"`);
    await table.clear();
  }

  async clearAll(): Promise<void> {
    await this.db.transaction("rw", this.db.tables, async () => {
      await Promise.all(this.db.tables.map((table) => table.clear()));
    });
  }

  private async quarantineIfInvalid(tableName: string, record: unknown): Promise<boolean> {
    if (!isStorageTable(tableName)) return false;
    const parsed = TABLE_SCHEMAS[tableName].safeParse(record);
    if (parsed.success) return false;

    const key = rowKeyOf(record);
    await this.db.quarantine.put({
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      table: tableName,
      raw: record,
      error: parsed.error.message,
      at: new Date().toISOString(),
    });
    if (key !== undefined) {
      await this.db.table(tableName).delete(key);
    }
    return true;
  }
}
