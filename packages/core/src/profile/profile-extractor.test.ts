// FR-003: Tests for structured profile extraction and caching.
import { describe, expect, it, vi } from "vitest";
import { MockProviderAdapter } from "../providers/mock-adapter";
import { MemoryStorageAdapter } from "../storage/memory-storage";
import type { StructuredProfileRow } from "../schemas/storage-rows.schema";
import { extractProfile } from "./profile-extractor";

describe("Profile Extractor & Caching (FR-003)", () => {
  it("extracts structured profile via AI provider and caches in storage", async () => {
    const storage = new MemoryStorageAdapter();
    const mockProvider = new MockProviderAdapter({
      mockObjectResponse: {
        skills: ["React", "TypeScript", "Vite", "Node.js"],
        experiences: [
          {
            role: "Frontend Engineer",
            company: "Acme Inc",
            highlights: ["Built interactive SPA", "Improved Web Vitals"],
          },
        ],
        gaps: ["Kubernetes"],
        quantifiedClaims: ["Improved Web Vitals by 25%"],
      },
    });

    const generateObjectSpy = vi.spyOn(mockProvider, "generateObject");

    const result = await extractProfile({
      resumeText: "Frontend Engineer at Acme Inc. Experienced with React, TypeScript, and Vite.",
      jdText: "Looking for a React developer with Kubernetes knowledge.",
      targetRole: "Frontend Engineer",
      level: "mid",
      provider: mockProvider,
      storage,
    });

    expect(result.fromCache).toBe(false);
    expect(result.usedFallback).toBe(false);
    expect(result.profile.skills).toContain("React");
    expect(result.profile.skills).toContain("TypeScript");
    expect(result.profile.experiences[0]?.company).toBe("Acme Inc");
    expect(generateObjectSpy).toHaveBeenCalledTimes(1);

    // Verify row was stored in structuredProfiles table
    const storedRows = await storage.getAll<StructuredProfileRow>("structuredProfiles");
    expect(storedRows).toHaveLength(1);
    expect(storedRows[0]?.inputHash).toBe(result.profile.inputHash);
  });

  it("serves from cache and avoids AI provider calls on unchanged inputs (FR-003 Acceptance Criterion)", async () => {
    const storage = new MemoryStorageAdapter();
    const mockProvider = new MockProviderAdapter({
      mockObjectResponse: {
        skills: ["Go", "Distributed Systems", "PostgreSQL"],
        experiences: [
          {
            role: "Backend Engineer",
            company: "DataCorp",
            highlights: ["Engineered streaming pipeline"],
          },
        ],
        gaps: [],
        quantifiedClaims: [],
      },
    });

    const generateObjectSpy = vi.spyOn(mockProvider, "generateObject");

    const input = {
      resumeText: "Backend engineer with Go and PostgreSQL experience.",
      jdText: "Senior Go engineer wanted.",
      targetRole: "Backend Engineer",
      level: "senior",
      provider: mockProvider,
      storage,
    };

    // First call: calls provider and writes to cache
    const firstResult = await extractProfile(input);
    expect(firstResult.fromCache).toBe(false);
    expect(generateObjectSpy).toHaveBeenCalledTimes(1);

    // Second call with IDENTICAL inputs: MUST hit cache, NO provider calls
    const secondResult = await extractProfile(input);
    expect(secondResult.fromCache).toBe(true);
    expect(secondResult.profile.inputHash).toBe(firstResult.profile.inputHash);
    expect(secondResult.profile.skills).toEqual(firstResult.profile.skills);
    // Provider MUST NOT have been called again!
    expect(generateObjectSpy).toHaveBeenCalledTimes(1);
  });

  it("uses deterministic fallback extractor when provider fails or is omitted", async () => {
    const storage = new MemoryStorageAdapter();

    const result = await extractProfile({
      resumeText: `
        Jane Doe
        Skills: React, TypeScript, Node.js, Docker, PostgreSQL
        Experience:
        - Spearheaded migration to Next.js, improving page load by 40%
        - Architected microservices handling 15,000 requests per minute
      `,
      jdText: "Required: React, TypeScript, Kubernetes, AWS",
      targetRole: "Senior Frontend Engineer",
      level: "senior",
      storage,
      // No provider supplied
    });

    expect(result.usedFallback).toBe(true);
    expect(result.fromCache).toBe(false);
    // Fallback matched taxonomy skills
    expect(result.profile.skills).toContain("frontend");
    expect(result.profile.skills).toContain("databases");
    expect(result.profile.skills).toContain("cloud_devops");
    // Fallback identified JD gaps (Kubernetes, AWS are in JD but not in Resume)
    expect(result.profile.gaps).toContain("kubernetes");
    expect(result.profile.gaps).toContain("aws");
    // Fallback identified quantified claims
    expect(result.profile.quantifiedClaims?.some((c) => c.includes("40%"))).toBe(true);
  });
});
