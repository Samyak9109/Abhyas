// FR-012, AI-013, AI-014: Unit tests for layered interview context builder, rolling summary, and small-model budgeting.
import { describe, expect, it } from "vitest";
import {
  buildLayeredInterviewContext,
  buildRollingSummary,
  buildVerbatimTurns,
  estimateTokenCount,
  getLevelExpectationSummary,
  type TurnContextItem,
} from "./context-builder.js";
import type { StructuredProfile } from "../schemas/profile.schema.js";

describe("context-builder", () => {
  const sampleProfile: StructuredProfile = {
    id: "prof-1",
    inputHash: "hash-prof-1",
    promptVersion: 1,
    skills: ["React", "TypeScript", "Node.js", "PostgreSQL", "Docker", "Redis", "Kafka"],
    experiences: [
      {
        role: "Senior Software Engineer",
        company: "Acme Corp",
        highlights: [
          "Led architecture migration to microservices",
          "Reduced p99 query latency by 45%",
        ],
      },
    ],
    gaps: ["Kubernetes", "GraphQL"],
    quantifiedClaims: ["Reduced bundle size by 35%", "Scaled system to 2M DAU"],
    condensed: "Full Stack Engineer (senior). Skills: React, TS, Node, Postgres. Scaled to 2M DAU.",
  };

  const sampleTurns: TurnContextItem[] = [
    {
      index: 0,
      questionText: "How do you optimize a slow database query in production?",
      answerText:
        "I first inspect EXPLAIN ANALYZE, look at sequential scans, create targeted B-tree indices, and check connection pooling.",
      skillTags: ["databases", "backend"],
      score: 85,
      evaluationTopFix: "Include connection pool exhaustion considerations.",
    },
    {
      index: 1,
      questionText: "Describe a time you handled a distributed system outage.",
      answerText:
        "Our message queue backed up during peak traffic. I enabled dead-letter queue routing, scaled consumer pods, and implemented backoff.",
      skillTags: ["distributed_systems", "ownership"],
      score: 90,
      evaluationTopFix: "Clarify runbook documentation steps post-incident.",
    },
    {
      index: 2,
      questionText: "How do you ensure frontend rendering performance for large lists?",
      answerText:
        "I implement windowing or virtualization using react-window, memoize selectors with reselect, and avoid inline arrow functions.",
      skillTags: ["frontend", "react"],
      score: 80,
      evaluationTopFix: "Mention virtualization DOM overhead trade-offs.",
    },
    {
      index: 3,
      questionText: "What trade-offs exist between optimistic and pessimistic UI updates?",
      answerText:
        "Optimistic updates feel instantaneous but require complex rollback state; pessimistic updates ensure strict consistency at the cost of perceived latency.",
      skillTags: ["frontend", "architecture"],
      score: 95,
      evaluationTopFix: "Discuss idempotent server endpoints for rollbacks.",
    },
    {
      index: 4,
      questionText: "How do you handle schema migrations with zero downtime?",
      answerText:
        "I use expand and contract patterns: add nullable column, double-write, backfill historical rows, switch reads, and drop unused column.",
      skillTags: ["databases", "devops"],
      score: 88,
      evaluationTopFix: "Reference lock timeouts on DDL commands.",
    },
  ];

  describe("estimateTokenCount", () => {
    it("returns 0 for empty or null text", () => {
      expect(estimateTokenCount("")).toBe(0);
    });

    it("approximates ~4 characters per token", () => {
      const text = "1234567890123456"; // 16 chars
      expect(estimateTokenCount(text)).toBe(4);
    });
  });

  describe("getLevelExpectationSummary", () => {
    it("returns specific expectations for all five levels", () => {
      const levels = ["intern_fresher", "junior", "mid", "senior", "staff_plus"] as const;
      for (const lvl of levels) {
        const summary = getLevelExpectationSummary(lvl);
        expect(summary).toBeTruthy();
        expect(summary).toContain("Level Expectation:");
      }
    });
  });

  describe("buildRollingSummary", () => {
    it("returns empty string if no earlier turns", () => {
      expect(buildRollingSummary([])).toBe("");
    });

    it("summarizes turns into compact lines with scores and tags", () => {
      const summary = buildRollingSummary(sampleTurns.slice(0, 2));
      expect(summary).toContain("- Q1 [databases, backend]:");
      expect(summary).toContain("- Q2 [distributed_systems, ownership]:");
      expect(summary).toContain("(Score: 85%)");
      expect(summary).toContain("(Score: 90%)");
    });

    it("truncates if summary exceeds max tokens limit", () => {
      const summary = buildRollingSummary(sampleTurns, 20); // 20 tokens = 80 chars max
      expect(summary.length).toBeLessThanOrEqual(85);
      expect(summary.endsWith("...")).toBe(true);
    });
  });

  describe("buildVerbatimTurns", () => {
    it("returns empty string if no recent turns", () => {
      expect(buildVerbatimTurns([])).toBe("");
    });

    it("formats recent turns with full verbatim text and improvement note", () => {
      const verbatim = buildVerbatimTurns([sampleTurns[0]!]);
      expect(verbatim).toContain('Interviewer: "How do you optimize a slow database query');
      expect(verbatim).toContain('Candidate: "I first inspect EXPLAIN ANALYZE');
      expect(verbatim).toContain("Evaluation: Scored 85%");
      expect(verbatim).toContain("Improvement Note: Include connection pool");
    });
  });

  describe("buildLayeredInterviewContext (AI-013 & AI-014)", () => {
    it("assembles all 7 layers in the specified structure", () => {
      const result = buildLayeredInterviewContext({
        targetRole: "Senior Backend Engineer",
        level: "senior",
        interviewStyle: "technical_deep_dive",
        profile: sampleProfile,
        companyPack: {
          name: "Stripe",
          cultureValues: ["Users First", "Move Fast", "High Rigor"],
          interviewFocus: ["API Durability", "Idempotency"],
          techStack: ["Ruby", "Go", "PostgreSQL", "Kafka"],
        },
        completedTurns: sampleTurns,
        currentQuestion: "How would you design an idempotent payment processing endpoint?",
        instruction: "Probe for edge cases regarding distributed race conditions.",
        isSmallModel: false,
      });

      // Check messages structure
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]?.role).toBe("system");
      expect(result.messages[1]?.role).toBe("user");

      // Layer 1: System Rules
      expect(result.layers.systemRules).toContain("objective engineering interviewer");

      // Layer 2: Level and Persona
      expect(result.layers.levelPersona).toContain("Senior Backend Engineer");
      expect(result.layers.levelPersona).toContain("Distributed architecture");

      // Layer 3: Condensed Profile
      expect(result.layers.condensedProfile).toContain("Candidate Verified Profile:");
      expect(result.layers.condensedProfile).toContain("Full Stack Engineer");

      // Layer 4: Delimited Company Pack (as data)
      expect(result.layers.delimitedCompanyPack).toContain('<company_data name="Stripe">');
      expect(result.layers.delimitedCompanyPack).toContain("Users First");
      expect(result.layers.delimitedCompanyPack).toContain("</company_data>");

      // Layer 5: Rolling Summary of Earlier Turns (turns 0 and 1, since standard keeps last 3 verbatim)
      expect(result.layers.rollingSummary).toContain("- Q1 [databases, backend]:");
      expect(result.layers.rollingSummary).toContain("- Q2 [distributed_systems, ownership]:");

      // Layer 6: Verbatim Turns (turns 2, 3, 4)
      expect(result.layers.verbatimTurns).toContain("Turn 3:");
      expect(result.layers.verbatimTurns).toContain("Turn 4:");
      expect(result.layers.verbatimTurns).toContain("Turn 5:");

      // Layer 7: Current Question & Instruction
      expect(result.layers.currentQuestion).toContain(
        'Current Question: "How would you design an idempotent payment processing endpoint?"'
      );
      expect(result.layers.currentQuestion).toContain(
        "Instruction: Probe for edge cases regarding distributed race conditions."
      );
    });

    it("respects small local model context budget (< 3,000 tokens) (AI-014)", () => {
      const result = buildLayeredInterviewContext({
        targetRole: "Staff Systems Engineer",
        level: "staff_plus",
        profile: sampleProfile,
        completedTurns: sampleTurns,
        currentQuestion: "Explain your multi-year strategy for decoupling the monolith.",
        isSmallModel: true,
      });

      // Small model keeps last 2 turns verbatim and summarizes the earlier 3 turns
      expect(result.layers.rollingSummary).toContain("- Q1");
      expect(result.layers.rollingSummary).toContain("- Q2");
      expect(result.layers.rollingSummary).toContain("- Q3");

      expect(result.layers.verbatimTurns).toContain("Turn 4:");
      expect(result.layers.verbatimTurns).toContain("Turn 5:");

      // Estimated token budget must remain strictly under 3,000 tokens
      expect(result.estimatedTokens).toBeLessThan(3000);
      expect(result.estimatedTokens).toBeGreaterThan(100);
    });

    it("handles initial session with 0 completed turns gracefully", () => {
      const result = buildLayeredInterviewContext({
        targetRole: "Junior Frontend Developer",
        level: "junior",
        completedTurns: [],
        currentQuestion: "Tell me about your experience with modern JavaScript frameworks.",
      });

      expect(result.layers.rollingSummary).toBe("");
      expect(result.layers.verbatimTurns).toBe("");
      expect(result.layers.currentQuestion).toContain("Tell me about your experience");
      expect(result.messages[1]?.content).toContain("Tell me about your experience");
    });

    it("enforces strict anti-hallucination instruction when no company pack is selected (FR-025, AI-021)", () => {
      const result = buildLayeredInterviewContext({
        targetRole: "Full Stack Engineer",
        level: "mid",
        completedTurns: [],
        currentQuestion: "Describe a challenging bug you fixed.",
      });

      expect(result.layers.systemRules).toContain("No verified company context is available");
      expect(result.layers.systemRules).toContain(
        "Do NOT assert, assume, or invent specific facts, tech stacks, or corporate culture details about any company"
      );
      expect(result.layers.delimitedCompanyPack).toBe("");
      expect(result.messages[0]?.content).not.toContain("<company_data");
    });

    it("injects full evidenced CompanyPack with tailoring directive into Layer 1 and Layer 4", () => {
      const fullPack = {
        schemaVersion: 1 as const,
        slug: "amazon",
        name: "Amazon",
        domain: "amazon.com",
        aliases: ["Amazon.com Inc."],
        retrievedAt: "2026-10-18T10:00:00.000Z",
        ttlDays: 90,
        coverage: "high" as const,
        overview: {
          value: "Global technology company focusing on e-commerce, cloud computing, and AI.",
          confidence: "documented" as const,
          sources: [{ url: "https://aboutamazon.com", title: "About", retrievedAt: "2026-10-18" }],
        },
        techStack: {
          value: ["Java", "AWS", "Python", "DynamoDB"],
          confidence: "documented" as const,
          sources: [{ url: "https://aws.amazon.com", title: "AWS", retrievedAt: "2026-10-18" }],
        },
        values: {
          value: [
            {
              name: "Customer Obsession",
              description: "Leaders start with customer and work backwards.",
            },
            { name: "Ownership", description: "Leaders are owners and think long term." },
          ],
          confidence: "documented" as const,
          sources: [{ url: "https://amazon.jobs", title: "LP", retrievedAt: "2026-10-18" }],
        },
      };

      const result = buildLayeredInterviewContext({
        targetRole: "Backend Engineer",
        level: "senior",
        companyPack: fullPack,
        completedTurns: [],
        currentQuestion: "Tell me about a time you had to make a trade-off.",
      });

      expect(result.layers.systemRules).toContain(
        "You are conducting a realistic mock interview tailored for Amazon"
      );
      expect(result.layers.systemRules).toContain(
        "Tailor questions and follow-ups to probe alignment with verified company values"
      );
      expect(result.layers.delimitedCompanyPack).toContain('<company_data name="Amazon">');
      expect(result.layers.delimitedCompanyPack).toContain("Customer Obsession");
      expect(result.layers.delimitedCompanyPack).toContain(
        "Documented Tech Stack: Java, AWS, Python, DynamoDB"
      );
      expect(result.layers.delimitedCompanyPack).toContain("</company_data>");
    });
  });
});
