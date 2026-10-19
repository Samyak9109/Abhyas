// FR-025, FR-026, FR-029, ADR-008, ADR-010: Unit tests for client company pack service,
// caching, TTL, API client, static mirror fallback, and demand registration.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryStorageAdapter } from "@abhyas/core";
import {
  isPackStale,
  loadCompanyPack,
  getClientToken,
  fetchCompanyDirectory,
  requestCompanyResearch,
  submitCompanyReport,
} from "./company-pack-service.js";

describe("company-pack-service (FR-025, FR-026, FR-029, ADR-008, ADR-010)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

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

  describe("getClientToken (ADR-010)", () => {
    it("generates a random 32-character hex token and persists to storage", async () => {
      const storage = new MemoryStorageAdapter();
      const token1 = await getClientToken(storage);

      expect(token1).toHaveLength(32);
      expect(/^[0-9a-f]{32}$/.test(token1)).toBe(true);

      // Subsequent call should retrieve the same token
      const token2 = await getClientToken(storage);
      expect(token2).toBe(token1);
    });
  });

  describe("loadCompanyPack", () => {
    it("loads seed pack from bundled content on first load and caches it into storage", async () => {
      const storage = new MemoryStorageAdapter();

      // Ensure cache is empty
      const before = await storage.get("companyCache", "google");
      expect(before).toBeUndefined();

      // First load (API disabled)
      const result = await loadCompanyPack("google", storage, { apiUrl: "" });
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
      const secondResult = await loadCompanyPack("google", storage, { apiUrl: "" });
      expect(secondResult).not.toBeNull();
      expect(secondResult?.fromCache).toBe(true);
      expect(secondResult?.pack.name).toBe("Google");
    });

    it("fetches pack from remote API when available and caches it", async () => {
      const storage = new MemoryStorageAdapter();
      const mockPack = {
        schemaVersion: 1,
        slug: "remote-corp",
        name: "Remote Corp",
        domain: "remotecorp.com",
        aliases: [],
        retrievedAt: "2026-10-18T10:00:00.000Z",
        ttlDays: 30,
        coverage: "high",
        overview: {
          value: "Remote engineering powerhouse.",
          confidence: "documented",
          sources: [{ url: "https://remotecorp.com/about", title: "About", retrievedAt: "2026-10-18" }],
        },
      };

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({ slug: "remote-corp", status: "ready", pack: mockPack }),
      } as Response);

      const result = await loadCompanyPack("remote-corp", storage, { apiUrl: "http://api.test" });
      expect(fetchSpy).toHaveBeenCalledWith("http://api.test/v1/companies/remote-corp");
      expect(result).not.toBeNull();
      expect(result?.pack.name).toBe("Remote Corp");
      expect(result?.fromCache).toBe(false);

      // Cached in storage
      const cached = await storage.get<{ slug: string }>("companyCache", "remote-corp");
      expect(cached).toBeDefined();
    });

    it("falls back to static mirror when API fails", async () => {
      const storage = new MemoryStorageAdapter();
      const mirrorPack = {
        schemaVersion: 1,
        slug: "mirror-corp",
        name: "Mirror Corp",
        domain: "mirrorcorp.com",
        aliases: [],
        retrievedAt: "2026-10-18T10:00:00.000Z",
        ttlDays: 30,
        coverage: "medium",
        overview: {
          value: "Served from static CDN.",
          confidence: "documented",
          sources: [{ url: "https://mirrorcorp.com/about", title: "About", retrievedAt: "2026-10-18" }],
        },
      };

      vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes("api.test")) {
          throw new Error("Network offline");
        }
        if (urlStr.includes("mirror-corp.json")) {
          return {
            ok: true,
            json: async () => mirrorPack,
          } as Response;
        }
        return { ok: false } as Response;
      });

      const result = await loadCompanyPack("mirror-corp", storage, {
        apiUrl: "http://api.test",
        staticPacksUrl: "http://cdn.test/packs",
      });
      expect(result).not.toBeNull();
      expect(result?.pack.name).toBe("Mirror Corp");
    });

    it("returns null when requesting an unlisted company with no pack (general session fallback)", async () => {
      const storage = new MemoryStorageAdapter();
      const result = await loadCompanyPack("unlisted-startup", storage, { apiUrl: "" });
      expect(result).toBeNull();
    });
  });

  describe("fetchCompanyDirectory", () => {
    it("fetches directory from remote API with statuses including requested and queued", async () => {
      const mockList = [
        {
          slug: "google",
          name: "Google",
          domain: "google.com",
          aliases: ["Alphabet"],
          status: "ready",
          coverage: "high",
          last_researched_at: "2026-10-18T10:00:00.000Z",
        },
        {
          slug: "datadog",
          name: "Datadog",
          domain: "datadoghq.com",
          aliases: [],
          status: "requested",
          coverage: null,
          last_researched_at: null,
        },
      ];

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockList,
      } as Response);

      const items = await fetchCompanyDirectory({ apiUrl: "http://api.test" });
      expect(items).toHaveLength(2);
      expect(items[0]?.slug).toBe("google");
      expect(items[0]?.status).toBe("ready");
      expect(items[1]?.slug).toBe("datadog");
      expect(items[1]?.status).toBe("requested");
    });

    it("falls back seamlessly to bundled seed directory when API is disabled or fails", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("API offline"));

      const items = await fetchCompanyDirectory({ apiUrl: "http://api.test", staticPacksUrl: "" });
      expect(items.length).toBeGreaterThanOrEqual(10);
      expect(items.some((c) => c.slug === "google")).toBe(true);
    });
  });

  describe("requestCompanyResearch (FR-026, ADR-010)", () => {
    it("sends demand registration to API with anonymous client token", async () => {
      const storage = new MemoryStorageAdapter();
      let capturedBody: { domain?: string; client_token?: string; user_id?: string } | null = null;

      vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (_url, opts) => {
        capturedBody = JSON.parse(opts?.body as string);
        return {
          ok: true,
          json: async () => ({
            status: "requested",
            slug: "snowflake",
            message: "Demand registered",
          }),
        } as Response;
      });

      const res = await requestCompanyResearch("snowflake", {
        domain: "snowflake.com",
        apiUrl: "http://api.test",
        storage,
      });

      expect(res.ok).toBe(true);
      expect(res.status).toBe("requested");
      expect(capturedBody).not.toBeNull();
      const body = capturedBody!;
      expect(body.domain).toBe("snowflake.com");
      expect(typeof body.client_token).toBe("string");
      expect(body.client_token).toHaveLength(32);
      // Contains no user email or identity
      expect(body.user_id).toBeUndefined();
    });

    it("detects offline condition when API connection fails", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Failed to fetch"));

      const res = await requestCompanyResearch("figma", {
        apiUrl: "http://api.test",
      });

      expect(res.ok).toBe(false);
      expect(res.offline).toBe(true);
    });
  });

  describe("submitCompanyReport (FR-029)", () => {
    it("submits inaccuracy report to API without personal user details", async () => {
      let capturedBody: { company_slug?: string; field?: string; reason?: string } | null = null;

      vi.spyOn(globalThis, "fetch").mockImplementationOnce(async (_url, opts) => {
        capturedBody = JSON.parse(opts?.body as string);
        return {
          ok: true,
          json: async () => ({ id: 42, status: "received" }),
        } as Response;
      });

      const res = await submitCompanyReport("google", "Tech stack lists obsolete framework", {
        field: "techStack",
        apiUrl: "http://api.test",
      });

      expect(res.ok).toBe(true);
      expect(res.reportId).toBe(42);
      expect(capturedBody).not.toBeNull();
      const body = capturedBody!;
      expect(body.company_slug).toBe("google");
      expect(body.field).toBe("techStack");
      expect(body.reason).toBe("Tech stack lists obsolete framework");
    });

    it("detects offline condition when report API fails", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Connection refused"));

      const res = await submitCompanyReport("amazon", "Inaccurate values", {
        apiUrl: "http://api.test",
      });

      expect(res.ok).toBe(false);
      expect(res.offline).toBe(true);
    });
  });
});
