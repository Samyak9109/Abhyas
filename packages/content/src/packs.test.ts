// FR-025, ADR-008: Acceptance criteria & contract tests for company packs.
// Acceptance criteria:
// - Pack schema requires evidence (source URL, title, date) and confidence label per field.
// - Packs without evidence fail validation and CI.
// - Company pack validator enforces schema validity, unique slugs, unique domains, and date integrity.

import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  validateCompanyPack,
  validateCompanyPacks,
  validateCompanyPackIndex,
} from "./validator.js";
import { validateContentDirectory } from "./validate-directory.js";
import {
  SEED_COMPANY_PACKS,
  SEED_COMPANY_PACK_INDEX,
  getSeedCompanyPack,
  getSeedCompanyPackByDomain,
  searchSeedCompanyPacks,
} from "./packs.js";

const CONTENT_DIR = path.resolve(__dirname, "..");

describe("M4.1: Company Pack Contract & Validator (FR-025, ADR-008)", () => {
  const sampleValidPack = {
    schemaVersion: 1,
    slug: "example-tech",
    name: "Example Tech",
    domain: "example.tech",
    aliases: ["Example Technologies"],
    retrievedAt: "2026-10-18T10:00:00.000Z",
    ttlDays: 90,
    coverage: "high",
    overview: {
      value: "Developer platform company building cloud infrastructure.",
      confidence: "documented",
      sources: [
        {
          url: "https://example.tech/about",
          title: "About Example Tech",
          retrievedAt: "2026-10-18",
        },
      ],
    },
    techStack: {
      value: ["TypeScript", "Node.js", "React", "PostgreSQL"],
      confidence: "documented",
      sources: [
        {
          url: "https://example.tech/engineering",
          title: "Engineering Stack",
          retrievedAt: "2026-10-18",
        },
      ],
    },
    values: {
      value: [
        {
          name: "Customer Obsession",
          description: "Start with user needs and work backward.",
        },
      ],
      confidence: "documented",
      sources: [
        {
          url: "https://example.tech/values",
          title: "Company Values",
          retrievedAt: "2026-10-18",
        },
      ],
    },
  };

  describe("Validation of Valid Company Packs", () => {
    it("validates a well-formed company pack with evidenced claims and dates", () => {
      const pack = validateCompanyPack(sampleValidPack);
      expect(pack.slug).toBe("example-tech");
      expect(pack.name).toBe("Example Tech");
      expect(pack.techStack?.value).toContain("TypeScript");
      expect(pack.techStack?.sources[0]?.url).toBe("https://example.tech/engineering");
    });

    it("validates a collection of unique company packs with validateCompanyPacks", () => {
      const pack2 = {
        ...sampleValidPack,
        slug: "acme-corp",
        name: "Acme Corp",
        domain: "acme.example.com",
      };

      const packs = validateCompanyPacks([sampleValidPack, pack2]);
      expect(packs.length).toBe(2);
      expect(packs[0]?.slug).toBe("example-tech");
      expect(packs[1]?.slug).toBe("acme-corp");
    });

    it("validates production packs directory within packages/content", () => {
      const result = validateContentDirectory(CONTENT_DIR);
      expect(result.valid).toBe(true);
      expect(result.summary.packsCount).toBeGreaterThanOrEqual(1);
    });

    it("validates company pack index structure", () => {
      const index = {
        version: 1,
        updatedAt: "2026-10-18T10:00:00.000Z",
        companies: [
          {
            slug: "example-tech",
            name: "Example Tech",
            domain: "example.tech",
            aliases: [],
            coverage: "high",
            status: "ready",
            retrievedAt: "2026-10-18",
            ttlDays: 90,
          },
        ],
      };

      const parsed = validateCompanyPackIndex(index);
      expect(parsed.companies.length).toBe(1);
      expect(parsed.companies[0]?.status).toBe("ready");
    });
  });

  describe("Acceptance Criteria: Packs without evidence fail validation (ADR-008)", () => {
    it("fails when an evidenced field has empty sources array", () => {
      const packWithoutEvidence = {
        ...sampleValidPack,
        overview: {
          value: "Overview claim with empty sources array.",
          confidence: "documented",
          sources: [], // Empty sources
        },
      };

      expect(() => validateCompanyPack(packWithoutEvidence)).toThrowError(
        /Every evidenced field must contain at least one source/
      );
    });

    it("fails when sources field is completely omitted from an evidenced claim", () => {
      const packMissingSources = {
        ...sampleValidPack,
        overview: {
          value: "Overview claim with missing sources key.",
          confidence: "documented",
        },
      };

      expect(() => validateCompanyPack(packMissingSources)).toThrowError(
        /Company pack validation failed/
      );
    });

    it("fails when evidence source URL is invalid", () => {
      const packInvalidUrl = {
        ...sampleValidPack,
        overview: {
          value: "Overview claim with invalid URL source.",
          confidence: "documented",
          sources: [
            {
              url: "not-a-valid-http-url",
              title: "Source",
              retrievedAt: "2026-10-18",
            },
          ],
        },
      };

      expect(() => validateCompanyPack(packInvalidUrl)).toThrowError(/valid URL/);
    });

    it("fails when evidence source date is invalid or missing", () => {
      const packInvalidDate = {
        ...sampleValidPack,
        overview: {
          value: "Overview claim with invalid date.",
          confidence: "documented",
          sources: [
            {
              url: "https://example.tech/about",
              title: "Source",
              retrievedAt: "invalid-date-string",
            },
          ],
        },
      };

      expect(() => validateCompanyPack(packInvalidDate)).toThrowError(/ISO-8601 date/);
    });

    it("fails when a field uses confidence 'unknown' (architecture.md 15.1)", () => {
      const packWithUnknown = {
        ...sampleValidPack,
        cultureSignals: {
          value: ["Unknown culture"],
          confidence: "unknown",
          sources: [
            {
              url: "https://example.tech/about",
              title: "Source",
              retrievedAt: "2026-10-18",
            },
          ],
        },
      };

      expect(() => validateCompanyPack(packWithUnknown)).toThrowError(
        /omitted rather than filled in/
      );
    });

    it("fails when pack has no evidenced sections at all", () => {
      const emptyPack = {
        schemaVersion: 1,
        slug: "empty-corp",
        name: "Empty Corp",
        domain: "empty.com",
        aliases: [],
        retrievedAt: "2026-10-18",
        ttlDays: 60,
        coverage: "low",
      };

      expect(() => validateCompanyPack(emptyPack)).toThrowError(
        /must contain at least one evidenced section/
      );
    });

    it("fails when duplicate pack slugs are provided to validateCompanyPacks", () => {
      const duplicatePacks = [
        sampleValidPack,
        {
          ...sampleValidPack,
          name: "Different Name",
          domain: "different.example.com",
        },
      ];

      expect(() => validateCompanyPacks(duplicatePacks)).toThrowError(
        /Duplicate company pack slug "example-tech"/
      );
    });

    it("fails when duplicate canonical domains are provided to validateCompanyPacks", () => {
      const duplicateDomainPacks = [
        sampleValidPack,
        {
          ...sampleValidPack,
          slug: "example-tech-alt",
          name: "Example Tech Alt",
          domain: "example.tech", // same domain
        },
      ];

      expect(() => validateCompanyPacks(duplicateDomainPacks)).toThrowError(
        /Duplicate canonical domain "example.tech"/
      );
    });
  });

  describe("M4.2: Seed Packs for Popular Employers (FR-025, ADR-008)", () => {
    it("contains between 10 and 20 hand-reviewed seed company packs", () => {
      expect(SEED_COMPANY_PACKS.length).toBeGreaterThanOrEqual(10);
      expect(SEED_COMPANY_PACKS.length).toBeLessThanOrEqual(20);
    });

    it("verifies every seed pack adheres strictly to CompanyPackSchema with evidence", () => {
      for (const pack of SEED_COMPANY_PACKS) {
        const validated = validateCompanyPack(pack);
        expect(validated.slug).toBe(pack.slug);
        expect(validated.name).toBeTruthy();
        expect(validated.domain).toBeTruthy();
        expect(validated.coverage).toMatch(/high|medium|low/);

        // Verify every present evidenced field has at least one valid source
        const sections = [
          pack.overview,
          pack.products,
          pack.techStack,
          pack.values,
          pack.interviewProcess,
          pack.cultureSignals,
        ];
        const presentSections = sections.filter(Boolean);
        expect(presentSections.length).toBeGreaterThanOrEqual(1);

        for (const section of presentSections) {
          expect(section?.confidence).toMatch(/documented|inferred/);
          expect(section?.sources.length).toBeGreaterThanOrEqual(1);
          for (const source of section?.sources ?? []) {
            expect(source.url).toMatch(/^https?:\/\//);
            expect(source.title.trim().length).toBeGreaterThan(0);
            expect(source.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
          }
        }
      }
    });

    it("verifies all seed company pack slugs and domains are strictly unique", () => {
      const validated = validateCompanyPacks(SEED_COMPANY_PACKS);
      expect(validated.length).toBe(SEED_COMPANY_PACKS.length);
    });

    it("verifies directory validation reports between 10 and 20 valid production packs", () => {
      const result = validateContentDirectory(CONTENT_DIR);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.summary.packsCount).toBeGreaterThanOrEqual(10);
      expect(result.summary.packsCount).toBeLessThanOrEqual(20);
    });

    it("verifies SEED_COMPANY_PACK_INDEX correctly indexes all seed packs as ready", () => {
      const index = validateCompanyPackIndex(SEED_COMPANY_PACK_INDEX);
      expect(index.companies.length).toBe(SEED_COMPANY_PACKS.length);
      for (const item of index.companies) {
        expect(item.status).toBe("ready");
        expect(item.retrievedAt).toBeTruthy();
      }
    });

    it("looks up seed packs by slug and canonical domain", () => {
      const googleBySlug = getSeedCompanyPack("google");
      expect(googleBySlug?.name).toBe("Google");
      expect(googleBySlug?.domain).toBe("google.com");

      const stripeByDomain = getSeedCompanyPackByDomain("stripe.com");
      expect(stripeByDomain?.slug).toBe("stripe");
      expect(stripeByDomain?.name).toBe("Stripe");

      expect(getSeedCompanyPack("non-existent-corp")).toBeUndefined();
      expect(getSeedCompanyPackByDomain("non-existent.com")).toBeUndefined();
    });

    it("searches seed packs by company name, slug, domain, and aliases", () => {
      // By name
      const metaResults = searchSeedCompanyPacks("Meta");
      expect(metaResults.some((c) => c.slug === "meta")).toBe(true);

      // By alias
      const fbResults = searchSeedCompanyPacks("Facebook");
      expect(fbResults.some((c) => c.slug === "meta")).toBe(true);

      const awsResults = searchSeedCompanyPacks("AWS");
      expect(awsResults.some((c) => c.slug === "amazon")).toBe(true);

      // By domain
      const netflixResults = searchSeedCompanyPacks("netflix.com");
      expect(netflixResults.some((c) => c.slug === "netflix")).toBe(true);

      // Empty query returns all
      expect(searchSeedCompanyPacks("").length).toBe(SEED_COMPANY_PACKS.length);
    });
  });
});
