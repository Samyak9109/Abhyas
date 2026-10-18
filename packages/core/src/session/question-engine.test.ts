// FR-007: Question engine unit tests.
// Covers: difficulty distribution by level, ≥90% bank traceability in a
// 10-question session, repeat avoidance, unverified fallback, and mixed-type
// proportional distribution.
import { describe, expect, it } from "vitest";
import type { QuestionBank, SessionPlan } from "../schemas/index.js";
import type { CompanyPack } from "../schemas/pack.schema.js";
import type { ProviderAdapter } from "../providers/types.js";
import { getBankSkillStats, selectDrillQuestions, selectQuestions } from "./question-engine.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** 20-question bank spanning levels 1–5 and all question types. */
const BANK: QuestionBank = [
  // intern_fresher / junior  (difficulty 1)
  {
    id: "q-beh-001",
    text: "Tell me about a time you had to learn something new quickly to complete a project.",
    type: "behavioral",
    skillTags: ["ownership", "communication"],
    level: "intern_fresher",
    difficulty: 1,
    followUps: [],
    rubricHints: [],
    source: "test",
    license: "MIT",
  },
  {
    id: "q-beh-002",
    text: "Describe a situation where you had to work on a team to solve a problem.",
    type: "behavioral",
    skillTags: ["communication"],
    level: "intern_fresher",
    difficulty: 1,
    followUps: [],
    rubricHints: [],
    source: "test",
    license: "MIT",
  },
  {
    id: "q-tech-001",
    text: "Explain what a closure is in JavaScript and give a use case.",
    type: "technical",
    skillTags: ["frontend"],
    level: "intern_fresher",
    difficulty: 1,
    followUps: [],
    rubricHints: [],
    source: "test",
    license: "MIT",
  },
  {
    id: "q-tech-002",
    text: "What is the difference between REST and GraphQL?",
    type: "technical",
    skillTags: ["backend_apis"],
    level: "intern_fresher",
    difficulty: 1,
    followUps: [],
    rubricHints: [],
    source: "test",
    license: "MIT",
  },
  {
    id: "q-tech-001b",
    text: "What is the DOM and how does the browser construct it?",
    type: "technical",
    skillTags: ["frontend"],
    level: "intern_fresher",
    difficulty: 1,
    followUps: [],
    rubricHints: [],
    source: "test",
    license: "MIT",
  },
  {
    id: "q-tech-002b",
    text: "Explain HTTP status codes 200, 400, 404, and 500.",
    type: "technical",
    skillTags: ["backend_apis"],
    level: "intern_fresher",
    difficulty: 1,
    followUps: [],
    rubricHints: [],
    source: "test",
    license: "MIT",
  },
  // junior (difficulty 2)
  {
    id: "q-beh-003",
    text: "Tell me about a conflict you navigated at work.",
    type: "behavioral",
    skillTags: ["conflict", "communication"],
    level: "junior",
    difficulty: 2,
    followUps: [],
    rubricHints: [],
    source: "test",
    license: "MIT",
  },
  {
    id: "q-tech-003",
    text: "How do you handle cross-origin resource sharing in a web application?",
    type: "technical",
    skillTags: ["frontend", "backend_apis"],
    level: "junior",
    difficulty: 2,
    followUps: [],
    rubricHints: [],
    source: "test",
    license: "MIT",
  },
  {
    id: "q-tech-003b",
    text: "What is the difference between synchronous and asynchronous execution in Node.js?",
    type: "technical",
    skillTags: ["backend_apis"],
    level: "junior",
    difficulty: 2,
    followUps: [],
    rubricHints: [],
    source: "test",
    license: "MIT",
  },
  {
    id: "q-dsa-001",
    text: "Describe Floyd's cycle detection algorithm.",
    type: "dsa_verbal",
    skillTags: ["dsa"],
    level: "junior",
    difficulty: 2,
    followUps: [],
    rubricHints: [],
    source: "test",
    license: "MIT",
  },
  {
    id: "q-sys-001",
    text: "Design a simple URL shortening service.",
    type: "system_design",
    skillTags: ["system_design"],
    level: "junior",
    difficulty: 2,
    followUps: [],
    rubricHints: [],
    source: "test",
    license: "MIT",
  },
  // mid (difficulty 3)
  {
    id: "q-beh-004",
    text: "Describe a time you drove a cross-team alignment.",
    type: "behavioral",
    skillTags: ["leadership", "communication"],
    level: "mid",
    difficulty: 3,
    followUps: [],
    rubricHints: [],
    source: "test",
    license: "MIT",
  },
  {
    id: "q-tech-004",
    text: "How do you ensure idempotency in a payment API?",
    type: "technical",
    skillTags: ["backend_apis", "databases"],
    level: "mid",
    difficulty: 3,
    followUps: [],
    rubricHints: [],
    source: "test",
    license: "MIT",
  },
  {
    id: "q-tech-004b",
    text: "Explain database indexing and when B-Trees vs Hash indexes are used.",
    type: "technical",
    skillTags: ["databases"],
    level: "mid",
    difficulty: 3,
    followUps: [],
    rubricHints: [],
    source: "test",
    license: "MIT",
  },
  {
    id: "q-tech-004c",
    text: "How do connection pools optimize database access in high-load backend services?",
    type: "technical",
    skillTags: ["backend_apis", "databases"],
    level: "mid",
    difficulty: 3,
    followUps: [],
    rubricHints: [],
    source: "test",
    license: "MIT",
  },
  {
    id: "q-dsa-002",
    text: "How do you find the median of a stream of integers?",
    type: "dsa_verbal",
    skillTags: ["dsa"],
    level: "mid",
    difficulty: 3,
    followUps: [],
    rubricHints: [],
    source: "test",
    license: "MIT",
  },
  {
    id: "q-sys-002",
    text: "Design a distributed rate limiter.",
    type: "system_design",
    skillTags: ["system_design", "cloud_devops"],
    level: "mid",
    difficulty: 3,
    followUps: [],
    rubricHints: [],
    source: "test",
    license: "MIT",
  },
  // senior (difficulty 4)
  {
    id: "q-beh-005",
    text: "Describe a multi-quarter initiative you led.",
    type: "behavioral",
    skillTags: ["leadership", "ownership"],
    level: "senior",
    difficulty: 4,
    followUps: [],
    rubricHints: [],
    source: "test",
    license: "MIT",
  },
  {
    id: "q-tech-005",
    text: "Explain the CAP theorem and trade-offs in distributed database design.",
    type: "technical",
    skillTags: ["databases", "system_design"],
    level: "senior",
    difficulty: 4,
    followUps: [],
    rubricHints: [],
    source: "test",
    license: "MIT",
  },
  {
    id: "q-tech-005b",
    text: "How do you design database schema migrations without downtime for large datasets?",
    type: "technical",
    skillTags: ["databases"],
    level: "senior",
    difficulty: 4,
    followUps: [],
    rubricHints: [],
    source: "test",
    license: "MIT",
  },
  {
    id: "q-dsa-003",
    text: "Describe an approach to range minimum queries with segment trees.",
    type: "dsa_verbal",
    skillTags: ["dsa"],
    level: "senior",
    difficulty: 4,
    followUps: [],
    rubricHints: [],
    source: "test",
    license: "MIT",
  },
  {
    id: "q-sys-003",
    text: "Design a real-time collaborative editing system.",
    type: "system_design",
    skillTags: ["system_design", "cloud_devops"],
    level: "senior",
    difficulty: 4,
    followUps: [],
    rubricHints: [],
    source: "test",
    license: "MIT",
  },
  // staff_plus (difficulty 5)
  {
    id: "q-beh-006",
    text: "How do you navigate Conway's Law when restructuring an engineering org?",
    type: "behavioral",
    skillTags: ["leadership"],
    level: "staff_plus",
    difficulty: 5,
    followUps: [],
    rubricHints: [],
    source: "test",
    license: "MIT",
  },
  {
    id: "q-tech-006",
    text: "Formulate a multi-year monolith-to-microservices migration strategy.",
    type: "technical",
    skillTags: ["system_design", "cloud_devops"],
    level: "staff_plus",
    difficulty: 5,
    followUps: [],
    rubricHints: [],
    source: "test",
    license: "MIT",
  },
  {
    id: "q-tech-006b",
    text: "Design a multi-region active-active database replication architecture with deterministic conflict resolution.",
    type: "technical",
    skillTags: ["system_design", "databases"],
    level: "staff_plus",
    difficulty: 5,
    followUps: [],
    rubricHints: [],
    source: "test",
    license: "MIT",
  },
  {
    id: "q-tech-006c",
    text: "How do you establish engineering governance and architectural review boards across independent product lines?",
    type: "technical",
    skillTags: ["system_design", "leadership"],
    level: "staff_plus",
    difficulty: 5,
    followUps: [],
    rubricHints: [],
    source: "test",
    license: "MIT",
  },
  {
    id: "q-dsa-004",
    text: "Explain persistent data structures and their amortized complexity trade-offs.",
    type: "dsa_verbal",
    skillTags: ["dsa"],
    level: "staff_plus",
    difficulty: 5,
    followUps: [],
    rubricHints: [],
    source: "test",
    license: "MIT",
  },
  {
    id: "q-sys-004",
    text: "Design a globally distributed event sourcing system with causal consistency.",
    type: "system_design",
    skillTags: ["system_design"],
    level: "staff_plus",
    difficulty: 5,
    followUps: [],
    rubricHints: [],
    source: "test",
    license: "MIT",
  },
];

function makePlan(overrides: Partial<SessionPlan> = {}): SessionPlan {
  return {
    sessionId: "test-session-abc123",
    type: "technical",
    length: 5,
    style: "standard",
    inputMode: "text",
    level: "mid",
    targetRole: "Backend Engineer",
    createdAt: "2026-10-15T10:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("selectQuestions", () => {
  describe("bank traceability ≥90% in a 10-question session (FR-007 AC)", () => {
    it("10-question session: all questions should come from the bank (100% ≥ 90%)", async () => {
      const plan = makePlan({ length: 10, level: "mid", type: "mixed" });
      const result = await selectQuestions({ plan, bank: BANK, profile: null });

      expect(result.questions).toHaveLength(10);
      const tracedPct = result.bankTracedCount / 10;
      expect(tracedPct).toBeGreaterThanOrEqual(0.9);
    });
  });

  describe("difficulty distribution differs by level (FR-007 AC)", () => {
    it("intern_fresher gets only difficulty 1–2 questions", async () => {
      const plan = makePlan({ level: "intern_fresher", length: 5, type: "technical" });
      const result = await selectQuestions({ plan, bank: BANK, profile: null });

      expect(result.questions.length).toBeGreaterThan(0);
      // Normalized difficulty 0–1: difficulty 2 maps to 0.25.
      for (const q of result.questions) {
        expect(q.difficulty).toBeLessThanOrEqual(0.25);
      }
    });

    it("staff_plus gets only difficulty 4–5 questions", async () => {
      const plan = makePlan({ level: "staff_plus", length: 5, type: "technical" });
      const result = await selectQuestions({ plan, bank: BANK, profile: null });

      expect(result.questions.length).toBeGreaterThan(0);
      // Normalized: difficulty 4 maps to 0.75, difficulty 5 to 1.0.
      for (const q of result.questions) {
        expect(q.difficulty).toBeGreaterThanOrEqual(0.75);
      }
    });

    it("junior difficulty is strictly within [1–3] band", async () => {
      const plan = makePlan({ level: "junior", length: 5, type: "mixed" });
      const result = await selectQuestions({ plan, bank: BANK, profile: null });

      expect(result.questions.length).toBeGreaterThan(0);
      for (const q of result.questions) {
        // Normalized difficulty 3 → 0.5.
        expect(q.difficulty).toBeLessThanOrEqual(0.5);
      }
    });

    it("senior difficulty is within [3–5] band", async () => {
      const plan = makePlan({ level: "senior", length: 5, type: "behavioral" });
      const result = await selectQuestions({ plan, bank: BANK, profile: null });

      expect(result.questions.length).toBeGreaterThan(0);
      for (const q of result.questions) {
        // Normalized difficulty 3 → 0.5.
        expect(q.difficulty).toBeGreaterThanOrEqual(0.5);
      }
    });
  });

  describe("repeat avoidance (FR-007)", () => {
    it("avoids questions seen in recent sessions when pool allows", async () => {
      const plan = makePlan({ level: "mid", length: 5, type: "technical" });
      const recentIds = ["q-tech-004"];
      const result = await selectQuestions({
        plan,
        bank: BANK,
        profile: null,
        recentQuestionIds: recentIds,
      });

      expect(result.questions).toHaveLength(5);
      // q-tech-004 should be avoided when alternatives exist
      const hasRecent = result.questions.some((q) => q.id === "q-tech-004");
      expect(hasRecent).toBe(false);
    });

    it("falls back to including recent questions when pool is smaller than requested length", async () => {
      // 5 questions in tinyBank all marked as recent
      const tinyBank: QuestionBank = BANK.slice(0, 5).map((q) => ({
        ...q,
        level: "mid" as const,
        difficulty: 3,
      }));
      const plan = makePlan({ level: "mid", length: 5, type: "mixed" });
      const recentIds = tinyBank.map((q) => q.id);
      const result = await selectQuestions({
        plan,
        bank: tinyBank,
        profile: null,
        recentQuestionIds: recentIds,
      });

      // Should still return questions (fallback to full pool when deduped pool is too small).
      expect(result.questions.length).toBe(5);
    });
  });

  describe("gap skill boosting (FR-007)", () => {
    it("gap skills increase the likelihood of selecting matching questions", async () => {
      const plan = makePlan({ level: "mid", length: 5, type: "technical" });
      const profile = {
        id: "p1",
        inputHash: "abc",
        condensed: "",
        skills: [],
        experiences: [],
        gaps: ["databases"],
        promptVersion: 1,
      };

      // Run 10 seeded selections; databases questions should appear more often.
      let databaseHits = 0;
      for (let i = 0; i < 10; i++) {
        const p = { ...plan, sessionId: `session-${i}` };
        const r = await selectQuestions({ plan: p, bank: BANK, profile });
        if (r.questions.some((q) => q.skillTags.includes("databases"))) {
          databaseHits++;
        }
      }
      // Databases-tagged questions should appear in the majority of runs.
      expect(databaseHits).toBeGreaterThanOrEqual(5);
    });
  });

  describe("unverified fallback (FR-007)", () => {
    it("emits unverified questions when the bank has no eligible questions", async () => {
      // An empty bank for the requested type/level → unverified fallback.
      const plan = makePlan({ level: "mid", length: 5, type: "dsa_verbal" });
      const emptyBank: QuestionBank = BANK.filter((q) => q.type !== "dsa_verbal");
      // Remove all mid-range too so no eligible questions remain.
      const strippedBank = emptyBank.filter(
        (q) => !(q.level === "mid" && q.difficulty >= 2 && q.difficulty <= 4)
      );

      const result = await selectQuestions({ plan, bank: strippedBank, profile: null });
      expect(result.unverifiedCount).toBeGreaterThan(0);
      const unverified = result.questions.filter((q) => q.isUnverified);
      expect(unverified.length).toBeGreaterThan(0);
    });
  });

  describe("mixed session proportional distribution", () => {
    it("mixed session selects across multiple question types", async () => {
      const plan = makePlan({ level: "mid", length: 10, type: "mixed" });
      const result = await selectQuestions({ plan, bank: BANK, profile: null });

      const types = new Set(result.questions.flatMap((q) => q.skillTags));
      // With 10 questions mixed across 4 types and sufficient bank, expect ≥2 distinct skill domains.
      expect(result.questions.length).toBe(10);
      expect(types.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe("deterministic output with same seed (PRNG)", () => {
    it("same sessionId produces same question order", async () => {
      const plan = makePlan({ level: "mid", length: 5, type: "technical" });
      const r1 = await selectQuestions({ plan, bank: BANK, profile: null });
      const r2 = await selectQuestions({ plan, bank: BANK, profile: null });

      expect(r1.questions.map((q) => q.id)).toEqual(r2.questions.map((q) => q.id));
    });
  });

  describe("SelectedQuestion schema validation", () => {
    it("all returned questions pass the SelectedQuestion Zod schema", async () => {
      const plan = makePlan({ level: "mid", length: 5, type: "technical" });
      const result = await selectQuestions({ plan, bank: BANK, profile: null });

      // selectQuestions already parses through SelectedQuestionSchema internally.
      // Confirm no unknown fields and all required fields are present.
      for (const q of result.questions) {
        expect(q).toHaveProperty("id");
        expect(q).toHaveProperty("isUnverified");
        expect(q).toHaveProperty("difficulty");
        expect(q).toHaveProperty("text");
        expect(q).toHaveProperty("skillTags");
        expect(typeof q.difficulty).toBe("number");
        expect(q.difficulty).toBeGreaterThanOrEqual(0);
        expect(q.difficulty).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("M2.4: Skill-wise practice drills (FR-016)", () => {
    it("getBankSkillStats returns accurate question counts across bank and level", () => {
      const stats = getBankSkillStats(BANK, "intern_fresher");
      expect(stats["dsa"]?.total).toBe(4);
      expect(stats["dsa"]?.atLevel).toBe(1);
      expect(stats["dsa"]?.available).toBe(true);
      expect(stats["non_existent"]).toBeUndefined();
    });

    it("selects questions targeted specifically to the requested skill", async () => {
      const plan = makePlan({
        level: "mid",
        length: 5,
        type: "dsa_verbal",
        isDrill: true,
        targetSkillId: "dsa",
        drillFormat: "quick_fire",
      });

      const result = await selectDrillQuestions({
        plan,
        bank: BANK,
        targetSkillId: "dsa",
      });

      expect(result.isBankEmpty).toBe(false);
      expect(result.questions.length).toBeGreaterThan(0);
      expect(result.bankTracedCount).toBe(result.questions.length);
      for (const q of result.questions) {
        expect(q.skillTags).toContain("dsa");
        // Quick fire strips follow-ups
        expect(q.followUps).toEqual([]);
      }
    });

    it("deep-dive drill format preserves follow-ups", async () => {
      const bankWithFollowUps: QuestionBank = [
        {
          id: "q-dsa-fu",
          text: "Explain segment tree.",
          type: "dsa_verbal",
          skillTags: ["dsa"],
          level: "senior",
          difficulty: 4,
          followUps: ["How do you handle lazy propagation?"],
          rubricHints: [],
          source: "test",
          license: "MIT",
        },
      ];

      const plan = makePlan({
        level: "senior",
        length: 5,
        type: "dsa_verbal",
        isDrill: true,
        targetSkillId: "dsa",
        drillFormat: "deep_dive",
      });

      const result = await selectDrillQuestions({
        plan,
        bank: bankWithFollowUps,
        targetSkillId: "dsa",
      });

      expect(result.questions[0]?.followUps).toEqual(["How do you handle lazy propagation?"]);
    });

    it("handles missing bank questions gracefully (empty bank for skill)", async () => {
      const plan = makePlan({
        level: "mid",
        length: 5,
        type: "behavioral",
        isDrill: true,
        targetSkillId: "quantum_algorithms",
        drillFormat: "quick_fire",
      });

      const result = await selectDrillQuestions({
        plan,
        bank: BANK,
        targetSkillId: "quantum_algorithms",
      });

      expect(result.isBankEmpty).toBe(true);
      expect(result.questions).toEqual([]);
      expect(result.bankTracedCount).toBe(0);
      expect(result.availableInBank).toBe(0);
    });
  });

  describe("company pack tailoring (FR-025, AI-014, AI-021)", () => {
    const amazonPack: CompanyPack = {
      schemaVersion: 1,
      slug: "amazon",
      name: "Amazon",
      domain: "amazon.com",
      aliases: ["Amazon.com"],
      retrievedAt: "2026-10-18T10:00:00.000Z",
      ttlDays: 90,
      coverage: "high",
      overview: {
        value: "Global technology company focusing on e-commerce, cloud, and AI.",
        confidence: "documented",
        sources: [{ url: "https://amazon.com", title: "Amazon", retrievedAt: "2026-10-18" }],
      },
      techStack: {
        value: ["Java", "AWS", "Python", "DynamoDB"],
        confidence: "documented",
        sources: [{ url: "https://aws.amazon.com", title: "AWS", retrievedAt: "2026-10-18" }],
      },
      values: {
        value: [
          { name: "Customer Obsession", description: "Leaders start with the customer." },
          { name: "Ownership", description: "Leaders act on behalf of the entire company." },
        ],
        confidence: "documented",
        sources: [{ url: "https://amazon.jobs", title: "LP", retrievedAt: "2026-10-18" }],
      },
    };

    const stripePack: CompanyPack = {
      schemaVersion: 1,
      slug: "stripe",
      name: "Stripe",
      domain: "stripe.com",
      aliases: ["Stripe Inc."],
      retrievedAt: "2026-10-18T10:00:00.000Z",
      ttlDays: 90,
      coverage: "high",
      overview: {
        value: "Financial infrastructure platform for internet commerce.",
        confidence: "documented",
        sources: [{ url: "https://stripe.com", title: "Stripe", retrievedAt: "2026-10-18" }],
      },
      techStack: {
        value: ["Ruby", "Go", "PostgreSQL", "Kafka", "Redis"],
        confidence: "documented",
        sources: [{ url: "https://stripe.com/blog", title: "Tech", retrievedAt: "2026-10-18" }],
      },
      values: {
        value: [
          { name: "Users First", description: "Prioritize merchant prosperity." },
          { name: "Meticulous Craftsmanship", description: "Polish APIs to highest standard." },
        ],
        confidence: "documented",
        sources: [{ url: "https://stripe.com/jobs", title: "Culture", retrievedAt: "2026-10-18" }],
      },
    };

    it("weights behavioral questions matching company values higher (FR-025)", async () => {
      const plan = makePlan({ level: "mid", length: 5, type: "behavioral" });
      // In BANK, q-beh-004 is about conflict resolution, q-beh-002 is about ownership
      // With amazonPack (Customer Obsession, Ownership), q-beh-002 should receive a 2.0x boost
      let ownershipPicks = 0;
      for (let i = 0; i < 10; i++) {
        const p = { ...plan, sessionId: `session-amazon-${i}` };
        const result = await selectQuestions({
          plan: p,
          bank: BANK,
          profile: null,
          companyPack: amazonPack,
        });
        if (result.questions.some((q) => q.skillTags.includes("ownership"))) {
          ownershipPicks++;
        }
      }
      expect(ownershipPicks).toBeGreaterThanOrEqual(6);
    });

    it("weights technical questions matching company tech stack higher (FR-025)", async () => {
      const plan = makePlan({ level: "mid", length: 5, type: "technical" });
      // Stripe uses PostgreSQL, Kafka, Redis. In BANK, q-tech-004 is tagged with "databases"
      let databasePicks = 0;
      for (let i = 0; i < 10; i++) {
        const p = { ...plan, sessionId: `session-stripe-${i}` };
        const result = await selectQuestions({
          plan: p,
          bank: BANK,
          profile: null,
          companyPack: stripePack,
        });
        if (result.questions.some((q) => q.skillTags.includes("databases"))) {
          databasePicks++;
        }
      }
      expect(databasePicks).toBeGreaterThanOrEqual(6);
    });

    it("with a company pack and adapter, questions can reference verified company fields", async () => {
      const capturedPrompts: string[] = [];
      const mockAdapter: ProviderAdapter = {
        id: "openai",
        capabilities: async () => ({
          streaming: true,
          jsonMode: "native",
          maxContextTokens: 4096,
        }),
        listModels: async () => ({
          ok: true,
          value: [{ id: "mock-model", label: "Mock Model" }],
        }),
        testConnection: async () => ({ ok: true, value: undefined }),
        generateObject: async <T>(messages: { role: string; content: string }[]) => {
          const userMsg = messages.find((m) => m.role === "user")?.content ?? "";
          capturedPrompts.push(userMsg);
          return {
            ok: true as const,
            value: {
              personalizedText: "At Stripe, how would you design a distributed queue with Kafka and Redis for payment idempotency?",
            } as T,
          };
        },
        stream: async function* () {
          yield { delta: "mock", isComplete: true };
        },
      };

      const plan = makePlan({ level: "senior", length: 5, type: "system_design" });
      const result = await selectQuestions({
        plan,
        bank: BANK,
        profile: null,
        companyPack: stripePack,
        adapter: mockAdapter,
      });

      // The prompt sent to adapter includes verified company context
      expect(capturedPrompts[0]).toContain("Target Company: Stripe");
      expect(capturedPrompts[0]).toContain("Verified Stack: Ruby, Go, PostgreSQL, Kafka, Redis");
      expect(capturedPrompts[0]).toContain("Verified Values: Users First, Meticulous Craftsmanship");

      // The selected question text references pack fields
      expect(result.questions[0]?.text).toContain("Stripe");
      expect(result.questions[0]?.text).toContain("Kafka");
      expect(result.questions[0]?.originalText).toBeDefined();
    });

    it("without a company pack, prompts strictly instruct not to invent company facts, and no company facts are stated (AI-021)", async () => {
      const capturedPrompts: string[] = [];
      const mockAdapter: ProviderAdapter = {
        id: "openai",
        capabilities: async () => ({
          streaming: true,
          jsonMode: "native",
          maxContextTokens: 4096,
        }),
        listModels: async () => ({
          ok: true,
          value: [{ id: "mock-model", label: "Mock Model" }],
        }),
        testConnection: async () => ({ ok: true, value: undefined }),
        generateObject: async <T>(messages: { role: string; content: string }[]) => {
          const userMsg = messages.find((m) => m.role === "user")?.content ?? "";
          capturedPrompts.push(userMsg);
          return {
            ok: true as const,
            value: {
              personalizedText: "As a Mid Full Stack Developer, describe how you implement optimistic UI updates.",
            } as T,
          };
        },
        stream: async function* () {
          yield { delta: "mock", isComplete: true };
        },
      };

      const plan = makePlan({ level: "mid", length: 5, type: "technical" });
      const result = await selectQuestions({
        plan,
        bank: BANK,
        profile: null,
        companyPack: null,
        adapter: mockAdapter,
      });

      // Prompt sent to adapter strictly warns against stating or inventing company facts
      expect(capturedPrompts[0]).toContain(
        "Company: None (general session). Do NOT state, assume, or invent company facts."
      );
      expect(result.questions[0]?.text).not.toContain("Stripe");
      expect(result.questions[0]?.text).not.toContain("Amazon");
      expect(result.questions[0]?.text).not.toContain("Google");
    });
  });
});
