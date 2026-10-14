// FR-001, ADR-004: Storage service — probes IndexedDB, falls back to in-memory
// mode with a visible banner, and requests persistent storage on first save.
import {
  AbhyasDatabase,
  DexieStorageAdapter,
  MemoryStorageAdapter,
  type StorageAdapter,
} from "@abhyas/core";

export type StorageMode = "persistent" | "memory";
type StorageOpenErrorKind = "version_conflict" | "unknown";

interface AppStorage {
  adapter: StorageAdapter;
  mode: StorageMode;
}

export class StorageOpenError extends Error {
  constructor(readonly kind: StorageOpenErrorKind) {
    super(`Failed to open storage: ${kind}`);
    this.name = "StorageOpenError";
  }
}

export function classifyOpenError(error: unknown): StorageOpenErrorKind {
  return (error as { name?: string })?.name === "VersionError" ? "version_conflict" : "unknown";
}

// QuotaExceededError surfaces from Dexie puts; the UI warns and prompts export (FR-001).
export function isQuotaExceededError(error: unknown): boolean {
  return (error as { name?: string })?.name === "QuotaExceededError";
}

// FR-001: "Request persistent storage on first save." Browsers may still refuse;
// the grant is best-effort and never blocks the write itself.
export class PersistOnFirstSaveAdapter implements StorageAdapter {
  private requested = false;

  constructor(private inner: StorageAdapter) {}

  async get<T>(table: string, key: string): Promise<T | undefined> {
    return this.inner.get<T>(table, key);
  }

  async put<T>(table: string, record: T): Promise<string> {
    const key = await this.inner.put(table, record);
    if (!this.requested) {
      this.requested = true;
      void navigator.storage?.persist?.();
    }
    return key;
  }

  async delete(table: string, key: string): Promise<void> {
    return this.inner.delete(table, key);
  }

  async getAll<T>(table: string): Promise<T[]> {
    return this.inner.getAll<T>(table);
  }

  async clear(table: string): Promise<void> {
    return this.inner.clear(table);
  }

  async clearAll(): Promise<void> {
    return this.inner.clearAll();
  }
}

export async function initStorage(dbName = "AbhyasDB"): Promise<AppStorage> {
  if (typeof indexedDB === "undefined") {
    return { adapter: new MemoryStorageAdapter(), mode: "memory" };
  }
  try {
    const db = new AbhyasDatabase(dbName);
    await db.open();
    return {
      adapter: new PersistOnFirstSaveAdapter(new DexieStorageAdapter(db)),
      mode: "persistent",
    };
  } catch (error) {
    // An older app build opened against newer-schema data: refuse and explain
    // (FR-001 edge case) instead of silently degrading.
    if (classifyOpenError(error) === "version_conflict") {
      throw new StorageOpenError("version_conflict");
    }
    return { adapter: new MemoryStorageAdapter(), mode: "memory" };
  }
}
