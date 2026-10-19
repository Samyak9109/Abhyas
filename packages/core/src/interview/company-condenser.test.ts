// FR-025, AI-014: Unit tests for company pack condenser.
import { describe, expect, it } from "vitest";
import { condenseCompanyPack } from "./company-condenser.js";
import type { CompanyPack } from "../schemas/pack.schema.js";

describe("company-condenser", () => {
  const samplePack: CompanyPack = {
    schemaVersion: 1,
    slug: "stripe",
    name: "Stripe",
    domain: "stripe.com",
    aliases: ["Stripe Payments"],
    retrievedAt: "2026-10-18T10:00:00.000Z",
    ttlDays: 90,
    coverage: "high",
    overview: {
      value: "Financial infrastructure platform for internet commerce.",
      confidence: "documented",
      sources: [{ url: "https://stripe.com/about", title: "About", retrievedAt: "2026-10-18" }],
    },
    products: {
      value: ["Payments", "Billing", "Connect", "Terminal", "Radar", "Tax"],
      confidence: "documented",
      sources: [
        { url: "https://stripe.com/products", title: "Products", retrievedAt: "2026-10-18" },
      ],
    },
    techStack: {
      value: [
        "Ruby",
        "Sorbet",
        "Go",
        "TypeScript",
        "PostgreSQL",
        "Redis",
        "Kafka",
        "AWS",
        "Kubernetes",
        "React",
      ],
      confidence: "documented",
      sources: [{ url: "https://stripe.com/blog", title: "Tech", retrievedAt: "2026-10-18" }],
    },
    values: {
      value: [
        {
          name: "Users First",
          description: "Prioritize merchant prosperity and developer experience.",
        },
        { name: "Move with Urgency", description: "Execute rapidly with precise discipline." },
        {
          name: "Meticulous Craftsmanship",
          description: "Polish APIs and reliability to the highest standard.",
        },
        { name: "Macro Curiosity", description: "Seek deep understanding of global economics." },
        { name: "Efficiency", description: "Work smart and scale leverage." },
      ],
      confidence: "documented",
      sources: [{ url: "https://stripe.com/jobs", title: "Culture", retrievedAt: "2026-10-18" }],
    },
    interviewProcess: {
      value: ["Recruiter screen", "Technical phone screen", "Onsite architecture and coding"],
      confidence: "documented",
      sources: [{ url: "https://stripe.com/jobs", title: "Interview", retrievedAt: "2026-10-18" }],
    },
    cultureSignals: {
      value: [
        "Interviews on candidate laptop",
        "Emphasis on written proposals",
        "Zero transaction inaccuracy tolerance",
      ],
      confidence: "documented",
      sources: [{ url: "https://stripe.com/blog", title: "Culture", retrievedAt: "2026-10-18" }],
    },
  };

  it("formats all evidenced sections in standard mode", () => {
    const condensed = condenseCompanyPack(samplePack);
    expect(condensed).toContain("Overview: Financial infrastructure platform");
    expect(condensed).toContain("Key Products: Payments, Billing, Connect, Terminal, Radar, Tax");
    expect(condensed).toContain(
      "Documented Tech Stack: Ruby, Sorbet, Go, TypeScript, PostgreSQL, Redis, Kafka, AWS, Kubernetes, React"
    );
    expect(condensed).toContain("Core Values:");
    expect(condensed).toContain("- Users First: Prioritize merchant prosperity");
    expect(condensed).toContain("- Move with Urgency: Execute rapidly");
    expect(condensed).toContain(
      "Documented Interview Process: Recruiter screen -> Technical phone screen -> Onsite architecture and coding"
    );
    expect(condensed).toContain(
      "Culture Signals: Interviews on candidate laptop; Emphasis on written proposals; Zero transaction inaccuracy tolerance"
    );
  });

  it("respects small local model character limits and item slicing (AI-014)", () => {
    const condensed = condenseCompanyPack(samplePack, { isSmallModel: true });
    // For small models, item counts are sliced (e.g. products <= 4, stack <= 8, values <= 4)
    expect(condensed).toContain("Key Products: Payments, Billing, Connect, Terminal");
    expect(condensed).not.toContain("Terminal, Radar, Tax");
    expect(condensed.length).toBeLessThanOrEqual(1600);
  });

  it("handles sparse packs without undefined or empty lines", () => {
    const sparsePack: CompanyPack = {
      schemaVersion: 1,
      slug: "minimal",
      name: "Minimal Co",
      domain: "minimal.example.com",
      aliases: [],
      retrievedAt: "2026-10-18T10:00:00.000Z",
      ttlDays: 90,
      coverage: "low",
      overview: {
        value: "A quiet boutique consultancy.",
        confidence: "documented",
        sources: [{ url: "https://minimal.example.com", title: "Home", retrievedAt: "2026-10-18" }],
      },
    };
    const condensed = condenseCompanyPack(sparsePack);
    expect(condensed).toBe("Overview: A quiet boutique consultancy.");
    expect(condensed).not.toContain("Tech Stack");
    expect(condensed).not.toContain("Core Values");
  });

  it("truncates with ellipsis when custom maxChars is exceeded", () => {
    const condensed = condenseCompanyPack(samplePack, { maxChars: 100 });
    expect(condensed.length).toBeLessThanOrEqual(100);
    expect(condensed.endsWith("...")).toBe(true);
  });
});
