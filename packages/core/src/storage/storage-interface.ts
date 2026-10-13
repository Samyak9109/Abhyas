// FR-001, NFR-023, ADR-001, ADR-004: Unified local-first storage interface.

export interface StorageAdapter {
  get<T>(table: string, key: string): Promise<T | undefined>;
  put<T>(table: string, record: T): Promise<string>;
  delete(table: string, key: string): Promise<void>;
  getAll<T>(table: string): Promise<T[]>;
  clear(table: string): Promise<void>;
  clearAll(): Promise<void>;
}
