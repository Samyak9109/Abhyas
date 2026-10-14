// FR-001: In-memory fallback adapter contract tests.
import { describe, expect, it } from "vitest";
import { MemoryStorageAdapter } from "./memory-storage";

describe("M1.1: MemoryStorageAdapter", () => {
  it("round-trips records keyed by id, key, slug or skillId", async () => {
    const storage = new MemoryStorageAdapter();

    await storage.put("profile", { id: "p1", name: "Ada" });
    await storage.put("settings", { key: "theme", value: "ink" });
    await storage.put("companyCache", { slug: "acme", pack: {} });
    await storage.put("skillStats", { skillId: "sk_1", score: 80 });

    expect(await storage.get("profile", "p1")).toEqual({ id: "p1", name: "Ada" });
    expect(await storage.get("settings", "theme")).toEqual({ key: "theme", value: "ink" });
    expect(await storage.get("companyCache", "acme")).toEqual({ slug: "acme", pack: {} });
    expect(await storage.get("skillStats", "sk_1")).toEqual({ skillId: "sk_1", score: 80 });
  });

  it("rejects records without a usable primary key", async () => {
    const storage = new MemoryStorageAdapter();
    await expect(storage.put("profile", { name: "no key" })).rejects.toThrow(
      "without an id, key, slug or skillId"
    );
  });

  it("deletes, lists and clears tables", async () => {
    const storage = new MemoryStorageAdapter();
    await storage.put("sessions", { id: "s1" });
    await storage.put("sessions", { id: "s2" });
    expect((await storage.getAll("sessions")).length).toBe(2);

    await storage.delete("sessions", "s1");
    expect((await storage.getAll<{ id: string }>("sessions")).map((r) => r.id)).toEqual(["s2"]);

    await storage.clear("sessions");
    expect(await storage.getAll("sessions")).toEqual([]);

    await storage.put("turns", { id: "t1" });
    await storage.clearAll();
    expect(await storage.getAll("turns")).toEqual([]);
  });
});
