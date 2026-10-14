// FR-001: Storage service tests — fallback mode and error classification.
import { MemoryStorageAdapter } from "@abhyas/core";
import { describe, expect, it, vi } from "vitest";
import {
  PersistOnFirstSaveAdapter,
  classifyOpenError,
  initStorage,
  isQuotaExceededError,
} from "./storage";

describe("M1.1: storage service", () => {
  it("falls back to in-memory mode when IndexedDB is unavailable", async () => {
    // jsdom provides no indexedDB global, mirroring blocked-storage browsers.
    const appStorage = await initStorage("ServiceTest_Memory");
    expect(appStorage.mode).toBe("memory");
    expect(await appStorage.adapter.getAll("profile")).toEqual([]);
  });

  it("classifies open errors: version conflict vs unknown", () => {
    expect(classifyOpenError(new Error("boom"))).toBe("unknown");
    expect(classifyOpenError({ name: "VersionError" })).toBe("version_conflict");
    expect(classifyOpenError(undefined)).toBe("unknown");
  });

  it("detects quota exceeded errors from storage writes", () => {
    expect(isQuotaExceededError({ name: "QuotaExceededError" })).toBe(true);
    expect(isQuotaExceededError(new Error("QuotaExceededError text"))).toBe(false);
    expect(isQuotaExceededError(null)).toBe(false);
  });

  it("requests persistent storage on the first save only", async () => {
    const persist = vi.fn().mockResolvedValue(true);
    Object.defineProperty(navigator, "storage", {
      value: { persist },
      configurable: true,
    });

    const adapter = new PersistOnFirstSaveAdapter(new MemoryStorageAdapter());
    await adapter.put("settings", { key: "theme", value: "ink" });
    await adapter.put("settings", { key: "theme", value: "paper" });

    expect(persist).toHaveBeenCalledTimes(1);

    delete (navigator as { storage?: unknown }).storage;
  });
});
