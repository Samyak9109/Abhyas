// FR-025, ADR-008: Unit tests for CompanyPackSchema, Evidenced, and EvidenceSourceSchema.
import { describe, expect, it } from "vitest";
import {
  CompanyPackSchema,
  CompanyPackIndexSchema,
  type CompanyPack,
} from "./pack.schema";

describe("CompanyPackSchema & Evidenced Contract (FR-025, ADR-008)", () => {
  const validPack: CompanyPack = {
    schemaVersion: 1,
    slug: "stripe",
    name: "Stripe",
    domain: "stripe.com",
    aliases: ["Stripe Inc", "Stripe Payments"],
    retrievedAt: "2026-10-18T10:00:00.000Z",
    ttlDays: 90,
    coverage: "high",
    overview: {
      value: "Financial infrastructure platform for the internet.",
      confidence: "documented",
      sources: [
        {
          url: "https://stripe.com/about",
          title: "Stripe About Page",
          retrievedAt: "2026-10-18",
        },
      ],
    },
    products: {
      value: ["Stripe Payments", "Stripe Connect", "Stripe Billing"],
      confidence: "documented",
      sources: [
        {
          url: "https://stripe.com/products",
          title: "Stripe Products Overview",
          retrievedAt: "2026-10-18",
        },
      ],
    },
    techStack: {
      value: ["Ruby", "Sorbet", "TypeScript", "React", "Go", "Java"],
      confidence: "documented",
      sources: [
        {
          url: "https://stripe.com/blog/sorbet-run-at-scale",
          title: "Sorbet at Stripe Engineering Blog",
          retrievedAt: "2026-10-18",
        },
      ],
    },
    values: {
      value: [
        {
          name: "Users First",
          description: "Solve real user problems before optimizing internally.",
        },
        {
          name: "Move with Urgency",
          description: "Bias towards action and rigorous execution.",
        },
      ],
      confidence: "documented",
      sources: [
        {
          url: "https://stripe.com/jobs/culture",
          title: "Stripe Operating Principles",
          retrievedAt: "2026-10-18",
        },
      ],
    },
    interviewProcess: {
      value: [
        "Recruiter screen",
        "Technical screen (live coding or system design in real editor)",
        "Onsite loop (architecture, coding, integration, company values)",
      ],
      confidence: "inferred",
      sources: [
        {
          url: "https://stripe.com/jobs/interviewing",
          title: "Interviewing at Stripe Guide",
          retrievedAt: "2026-10-18",
        },
      ],
    },
    cultureSignals: {
      value: ["Written memos over slide presentations", "Heavy emphasis on clear API design"],
      confidence: "inferred",
      sources: [
        {
          url: "https://stripe.com/blog/operating-principles",
          title: "Operating Principles Memo",
          retrievedAt: "2026-10-18",
        },
      ],
    },
  };

  it("successfully parses a complete, evidenced company pack", () => {
    const parsed = CompanyPackSchema.safeParse(validPack);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.slug).toBe("stripe");
      expect(parsed.data.overview?.sources.length).toBe(1);
      expect(parsed.data.techStack?.value).toContain("Ruby");
    }
  });

  it("successfully parses a minimal pack with at least one evidenced section", () => {
    const minimalPack = {
      schemaVersion: 1,
      slug: "acme-corp",
      name: "Acme Corp",
      domain: "acme.example.com",
      aliases: [],
      retrievedAt: "2026-10-18",
      ttlDays: 30,
      coverage: "low",
      techStack: {
        value: ["Node.js", "PostgreSQL"],
        confidence: "documented",
        sources: [
          {
            url: "https://acme.example.com/jobs",
            title: "Careers Stack",
            retrievedAt: "2026-10-18",
          },
        ],
      },
    };

    const parsed = CompanyPackSchema.safeParse(minimalPack);
    expect(parsed.success).toBe(true);
  });

  it("fails when an evidenced field has empty sources array (ADR-008)", () => {
    const noEvidencePack = {
      ...validPack,
      overview: {
        value: "Unverified claims without evidence.",
        confidence: "documented",
        sources: [], // Empty sources
      },
    };

    const parsed = CompanyPackSchema.safeParse(noEvidencePack);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toContain(
        "Every evidenced field must contain at least one source"
      );
    }
  });

  it("fails when an evidenced source is missing a valid URL", () => {
    const invalidUrlPack = {
      ...validPack,
      overview: {
        value: "Overview with bad URL.",
        confidence: "documented",
        sources: [
          {
            url: "not-a-valid-url",
            title: "Source Title",
            retrievedAt: "2026-10-18",
          },
        ],
      },
    };

    const parsed = CompanyPackSchema.safeParse(invalidUrlPack);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toContain("valid URL");
    }
  });

  it("fails when an evidenced source has an invalid or missing date", () => {
    const invalidDatePack = {
      ...validPack,
      overview: {
        value: "Overview with invalid date.",
        confidence: "documented",
        sources: [
          {
            url: "https://example.com",
            title: "Source Title",
            retrievedAt: "yesterday", // Invalid date
          },
        ],
      },
    };

    const parsed = CompanyPackSchema.safeParse(invalidDatePack);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toContain("ISO-8601 date");
    }
  });

  it("fails when confidence is 'unknown' because unknown fields should be omitted (architecture.md 15.1)", () => {
    const unknownConfidencePack = {
      ...validPack,
      techStack: {
        value: ["Unknown stack"],
        confidence: "unknown",
        sources: [
          {
            url: "https://example.com",
            title: "Source",
            retrievedAt: "2026-10-18",
          },
        ],
      },
    };

    const parsed = CompanyPackSchema.safeParse(unknownConfidencePack);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const msgs = parsed.error.issues.map((i) => i.message).join(" ");
      expect(msgs).toContain("omitted rather than filled in");
    }
  });

  it("fails when the pack has zero evidenced sections", () => {
    const emptyPack = {
      schemaVersion: 1,
      slug: "ghost-corp",
      name: "Ghost Corp",
      domain: "ghost.com",
      aliases: [],
      retrievedAt: "2026-10-18",
      ttlDays: 60,
      coverage: "low",
    };

    const parsed = CompanyPackSchema.safeParse(emptyPack);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toContain(
        "must contain at least one evidenced section"
      );
    }
  });

  it("fails when slug format is invalid (uppercase, spaces, special chars)", () => {
    const badSlugPack = {
      ...validPack,
      slug: "Stripe Inc!",
    };

    const parsed = CompanyPackSchema.safeParse(badSlugPack);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toContain("Slug must be lowercase alphanumeric");
    }
  });

  it("validates CompanyPackIndexSchema for static index metadata", () => {
    const validIndex = {
      version: 1,
      updatedAt: "2026-10-18T10:00:00.000Z",
      companies: [
        {
          slug: "stripe",
          name: "Stripe",
          domain: "stripe.com",
          aliases: ["Stripe Inc"],
          coverage: "high",
          status: "ready",
          retrievedAt: "2026-10-18",
          ttlDays: 90,
        },
        {
          slug: "notion",
          name: "Notion",
          domain: "notion.so",
          aliases: [],
          coverage: "medium",
          status: "queued",
        },
      ],
    };

    const parsed = CompanyPackIndexSchema.safeParse(validIndex);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.companies.length).toBe(2);
      expect(parsed.data.companies[0]?.status).toBe("ready");
    }
  });
});
