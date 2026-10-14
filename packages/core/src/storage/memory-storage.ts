// FR-001: In-memory StorageAdapter fallback for when IndexedDB is unavailable.
// Data survives the session only; the UI must warn the user (FR-001 error path).
import type { StorageAdapter } from "./storage-interface";
import type { StorageTable } from "./table-registry";
import { rowKeyOf } from "./table-registry";

export class MemoryStorageAdapter implements StorageAdapter {
  private tables = new Map<StorageTable, Map<string, unknown>>();

  private tableFor(name: string): Map<string, unknown> {
    let table = this.tables.get(name as StorageTable);
    if (!table) {
      table = new Map();
      this.tables.set(name as StorageTable, table);
    }
    return table;
  }

  async get<T>(table: string, key: string): Promise<T | undefined> {
    return this.tableFor(table).get(key) as T | undefined;
  }

  async put<T>(table: string, record: T): Promise<string> {
    const key = rowKeyOf(record);
    if (key === undefined) {
      throw new Error(`Cannot store record in "${table}" without an id, key, slug or skillId`);
    }
    this.tableFor(table).set(key, record);
    return key;
  }

  async delete(table: string, key: string): Promise<void> {
    this.tableFor(table).delete(key);
  }

  async getAll<T>(table: string): Promise<T[]> {
    return [...this.tableFor(table).values()] as T[];
  }

  async clear(table: string): Promise<void> {
    this.tableFor(table).clear();
  }

  async clearAll(): Promise<void> {
    this.tables.clear();
  }
}
