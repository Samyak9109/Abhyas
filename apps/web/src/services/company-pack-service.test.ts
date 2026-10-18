// FR-025, ADR-008: Unit tests for client company pack service, caching, and TTL.
import { describe, expect, it } from "vitest";
import { MemoryStorageAdapter } from "@abhyas/core";
import {
  isPackStale,
  loadCompanyPack,
  getCompanyDirectory,
  searchCompanies,
} from "./company-pack-service.js";

describe("company-pack-service (FR-025, ADR-008)", () => {
  describe("isPackStale", () => {
    it("returns false when retrieval date is well within TTL", () => {
      const now = Date.parse("2026-10-18T12:00:00Z");
      // Retrieved 10 days ago with 90 day TTL
      const retrieved = "2026-10-08T12:00:00Z";
      expect(isPackStale(retrieved, 90, now)).toBe(false);
    });

    it("returns true when retrieval date exceeds TTL", () => {
      const now = Date.parse("2026-10-18T12:00:00Z");
      // Retrieved 100 days ago with 90 day TTL
      const retrieved = "2026-07-01T12:00:00Z";
      expect(isPackStale(retrieved, 90, now)).toBe(true);
    });

    it("handles invalid dates safely by returning false", () => {
      expect(isPackStale("invalid-date", 90)).toBe(false);
    });
  });

  describe("loadCompanyPack", () => {
    it("loads seed pack from bundled content on first load and caches it into storage", async () => {
      const storage = new MemoryStorageAdapter();

      // Ensure cache is empty
      const before = await storage.get("companyCache", "google");
      expect(before).toBeUndefined();

      // First load
      const result = await loadCompanyPack("google", storage);
      expect(result).not.toBeNull();
      expect(result?.pack.name).toBe("Google");
      expect(result?.pack.slug).toBe("google");
      expect(result?.fromCache).toBe(false);

      // Verify it was persisted into companyCache for offline availability
      const after = await storage.get<{ slug: string; pack: { name: string } }>(
        "companyCache",
        "google"
      );
      expect(after).toBeDefined();
      expect(after?.pack.name).toBe("Google");

      // Second load should read from cache
      const secondResult = await loadCompanyPack("google", storage);
      expect(secondResult).not.toBeNull();
      expect(secondResult?.fromCache).toBe(true);
      expect(secondResult?.pack.name).toBe("Google");
    });

    it("detects stale status when cached pack retrieval date is in the past", async () => {
      const storage = new MemoryStorageAdapter();

      // Pre-seed an expired pack in companyCache
      const oldPack = {
        schemaVersion: 1,
        slug: "old-corp",
        name: "Old Corp",
        domain: "oldcorp.com",
        aliases: [],
        retrievedAt: "2020-01-01",
        ttlDays: 30,
        coverage: "low",
        overview: {
          value: "An old corporation.",
          confidence: "documented",
          sources: [
            {
              url: "https://oldcorp.com/about",
              title: "About",
              retrievedAt: "2020-01-01",
            },
          ],
        },
      };

      await storage.put("companyCache", {
        slug: "old-corp",
        pack: oldPack,
        fetchedAt: "2020-01-01T00:00:00Z",
        packVersion: 1,
      });

      const loaded = await loadCompanyPack("old-corp", storage);
      expect(loaded).not.toBeNull();
      expect(loaded?.isStale).toBe(true);
      expect(loaded?.fromCache).toBe(true);
    });

    it("returns null when requesting a non-existent company", async () => {
      const storage = new MemoryStorageAdapter();
      const result = await loadCompanyPack("non-existent-company", storage);
      expect(result).toBeNull();
    });
  });

  describe("getCompanyDirectory & searchCompanies", () => {
    it("returns directory containing all seed companies with isStale status", () => {
      const directory = getCompanyDirectory();
      expect(directory.length).toBeGreaterThanOrEqual(10);
      const google = directory.find((c) => c.slug === "google");
      expect(google).toBeDefined();
      expect(google?.name).toBe("Google");
      expect(typeof google?.isStale).toBe("boolean");
    });

    it("searches companies by name, slug, domain, and aliases", () => {
      const byName = searchCompanies("Stripe");
      expect(byName.some((c) => c.slug === "stripe")).toBe(true);

      const byAlias = searchCompanies("Alphabet");
      expect(byAlias.some((c) => c.slug === "google")).toBe(true);

      const byDomain = searchCompanies("uber.com");
      expect(byDomain.some((c) => c.slug === "uber")).toBe(true);

      const bySlug = searchCompanies("microsoft");
      expect(bySlug.some((c) => c.slug === "microsoft")).toBe(true);
    });
  });
});
