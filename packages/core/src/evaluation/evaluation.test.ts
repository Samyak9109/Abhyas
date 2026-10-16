// FR-012, FR-013, ADR-006: Comprehensive unit tests for evaluation pipeline.
import { describe, expect, it } from "vitest";
import { MockProviderAdapter } from "../providers/mock-adapter.js";
import type { Evaluation } from "../schemas/evaluation.schema.js";
import type { ProviderAdapter } from "../providers/types.js";
import type { StructuredProfile } from "../schemas/profile.schema.js";
import type { SessionRow, TurnRow } from "../schemas/storage-rows.schema.js";
import { calculateDeliveryMetrics } from "./delivery-metrics.js";
import { generateGroundedRewrite, validateGrounding } from "./grounded-rewrite.js";
import { calculateTurnScore, evaluateAnswer } from "./rubric-evaluator.js";
import { computeSessionScorecard } from "./scorecard.js";

// Mock mid-level rubric for isolated core testing
const MOCK_MID_RUBRIC = {
  level: "mid" as const,
  description: "Mid-level engineer (3 to 5 years).",
  axes: {
    depth: "Thorough understanding of distributed patterns and DB indexing.",
    ambiguity: "Substantial ambiguity; candidate asks clarifying questions.",
    expectedScope: "Service-level architecture and data pipelines.",
    followUpPressure: "Rigorous follow-ups examining load failure modes.",
    behavioralExpectations: "Demonstrates strong ownership and mentoring.",
  },
  criteria: {
    relevance: {
      name: "Relevance & Directness",
      description: "Directly addresses core questions.",
      anchors: {
        "1": "Misses prompt completely.",
        "3": "Focuses on engineering trade-offs directly.",
        "5": "Pinpoints architectural tension immediately.",
      },
    },
    structure: {
      name: "Structural Framing",
      description: "Uses STAR and clear logical flow.",
      anchors: {
        "1": "Ad-hoc design that changes direction.",
        "3": "Well-organized presentation with clear steps.",
        "5": "Masterful systematic presentation.",
      },
    },
    depth: {
      name: "Technical & Conceptual Depth",
      description: "Understands operational failure modes.",
      anchors: {
        "1": "Superficial knowledge.",
        "3": "Solid depth on caching and DB isolation.",
        "5": "Impressive depth on lock contention and p99.",
      },
    },
    clarity: {
      name: "Clarity & Articulation",
      description: "Balances technical depth with succinct clarity.",
      anchors: {
        "1": "Rambling answers.",
        "3": "Speaks with clarity and good pacing.",
        "5": "Highly articulate and engaging delivery.",
      },
    },
    levelFit: {
      name: "Level Alignment",
      description: "Calibrated against 3-5 year expectations.",
      anchors: {
        "1": "Requires continuous hand-holding.",
        "3": "Quintessential mid-level engineer.",
        "5": "Exhibits senior-level instincts.",
      },
    },
  },
};

const MOCK_PROFILE: StructuredProfile = {
  id: "profile-1",
  inputHash: "hash-12345678",
  condensed:
    "Mid-level backend engineer experienced in TypeScript, PostgreSQL, Redis, and distributed queues at Acme Corp.",
  skills: ["TypeScript", "PostgreSQL", "Redis", "Distributed Queues"],
  experiences: [
    {
      role: "Backend Engineer",
      company: "Acme Corp",
      highlights: ["Built distributed queues and microservices"],
    },
  ],
  promptVersion: 1,
};

describe("Delivery Metrics Calculator (FR-012)", () => {
  it("calculates WPM accurately based on word count and duration", () => {
    // 30 words in 15 seconds -> (30 / (15/60)) = 120 WPM
    const text =
      "One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twenty-one twenty-two twenty-three twenty-four twenty-five twenty-six twenty-seven twenty-eight twenty-nine thirty.";
    const metrics = calculateDeliveryMetrics({
      answerText: text,
      durationSeconds: 15,
      pauseSeconds: 2.5,
    });

    expect(metrics.answerLengthWords).toBe(30);
    expect(metrics.wordsPerMinute).toBe(120);
    expect(metrics.pauseSeconds).toBe(2.5);
    expect(metrics.fillerWordCount).toBe(0);
  });

  it("detects and counts common verbal filler words", () => {
    const text =
      "Um, so basically I think, you know, we should actually use Redis like a cache, uh, right?";
    const metrics = calculateDeliveryMetrics({
      answerText: text,
      durationSeconds: 10,
    });

    expect(metrics.fillerWordCount).toBeGreaterThanOrEqual(5);
    expect(metrics.answerLengthWords).toBeGreaterThan(10);
  });

  it("safely handles 0 duration or empty text without division by zero", () => {
    const emptyMetrics = calculateDeliveryMetrics({
      answerText: "",
      durationSeconds: 0,
    });

    expect(emptyMetrics.answerLengthWords).toBe(0);
    expect(emptyMetrics.wordsPerMinute).toBe(0);
    expect(emptyMetrics.fillerWordCount).toBe(0);
  });
});

describe("Rubric Evaluator (FR-012, ADR-006)", () => {
  it("computes turn score via normalized formula ((mean - 1) / 4) * 100", () => {
    const allOnes: Evaluation = {
      criteria: {
        relevance: { score: 1, reason: "r", evidence: "e" },
        structure: { score: 1, reason: "r", evidence: "e" },
        depth: { score: 1, reason: "r", evidence: "e" },
        clarity: { score: 1, reason: "r", evidence: "e" },
        levelFit: { score: 1, reason: "r", evidence: "e" },
      },
      skillScores: {},
      topFix: "fix",
      unsupportedClaims: [],
    };
    expect(calculateTurnScore(allOnes)).toBe(0);

    const allThrees: Evaluation = {
      ...allOnes,
      criteria: {
        relevance: { score: 3, reason: "r", evidence: "e" },
        structure: { score: 3, reason: "r", evidence: "e" },
        depth: { score: 3, reason: "r", evidence: "e" },
        clarity: { score: 3, reason: "r", evidence: "e" },
        levelFit: { score: 3, reason: "r", evidence: "e" },
      },
    };
    expect(calculateTurnScore(allThrees)).toBe(50);

    const allFives: Evaluation = {
      ...allOnes,
      criteria: {
        relevance: { score: 5, reason: "r", evidence: "e" },
        structure: { score: 5, reason: "r", evidence: "e" },
        depth: { score: 5, reason: "r", evidence: "e" },
        clarity: { score: 5, reason: "r", evidence: "e" },
        levelFit: { score: 5, reason: "r", evidence: "e" },
      },
    };
    expect(calculateTurnScore(allFives)).toBe(100);
  });

  it("evaluates skipped answers immediately with score 0 without calling provider", async () => {
    const provider = new MockProviderAdapter({ id: "openai-compatible" });
    const outcome = await evaluateAnswer({
      question: { text: "Explain DB indexing", skillTags: ["databases"], difficulty: 3 },
      answerText: "[Skipped]",
      level: "mid",
      targetRole: "Backend Engineer",
      rubric: MOCK_MID_RUBRIC,
      provider,
    });

    expect(outcome.status).toBe("scored");
    if (outcome.status === "scored") {
      expect(outcome.turnScore).toBe(0);
      expect(outcome.evaluation.criteria.relevance.score).toBe(1);
      expect(outcome.isBasic).toBe(true);
    }
  });

  it("produces rule-based basic evaluation when forceBasic is requested or provider is omitted", async () => {
    const outcome = await evaluateAnswer({
      question: {
        text: "How do you design an idempotent payment API?",
        skillTags: ["backend_apis", "databases"],
        difficulty: 3,
      },
      answerText:
        "First, I clarify the constraints. When a client makes a request, we generate a unique idempotency key. " +
        "We store this key in PostgreSQL using an INSERT ON CONFLICT DO NOTHING transaction. " +
        "Therefore, if a duplicate request arrives within 24 hours with the same key, we return the cached response. " +
        "This ensures zero duplicate charges even under heavy network retries.",
      level: "mid",
      targetRole: "Backend Engineer",
      rubric: MOCK_MID_RUBRIC,
      forceBasic: true,
    });

    expect(outcome.status).toBe("scored");
    if (outcome.status === "scored") {
      expect(outcome.turnScore).toBeGreaterThanOrEqual(50);
      expect(outcome.isBasic).toBe(true);
      expect(outcome.evaluation.skillScores.backend_apis).toBeDefined();
      expect(outcome.evaluation.skillScores.databases).toBeDefined();
    }
  });

  it("evaluates with mock provider returning schema-valid output", async () => {
    const mockOutput: Evaluation = {
      criteria: {
        relevance: {
          score: 4,
          reason: "Directly addresses idempotency",
          evidence: "unique idempotency key",
        },
        structure: {
          score: 4,
          reason: "Clear sequence of steps",
          evidence: "First, I clarify constraints",
        },
        depth: {
          score: 4,
          reason: "Strong DB transaction isolation details",
          evidence: "INSERT ON CONFLICT",
        },
        clarity: { score: 4, reason: "Precise terminology", evidence: "cached response" },
        levelFit: {
          score: 4,
          reason: "Solid mid-level understanding",
          evidence: "zero duplicate charges",
        },
      },
      skillScores: { backend_apis: 75, databases: 75 },
      topFix:
        "Discuss race conditions between concurrent requests arriving at the exact same millisecond.",
      unsupportedClaims: [],
    };

    const provider = new MockProviderAdapter({
      id: "gemini",
      mockObjectResponse: mockOutput,
    });

    const outcome = await evaluateAnswer({
      question: {
        text: "Idempotency question",
        skillTags: ["backend_apis", "databases"],
        difficulty: 3,
      },
      answerText: "My detailed answer",
      level: "mid",
      targetRole: "Backend Engineer",
      rubric: MOCK_MID_RUBRIC,
      provider,
    });

    expect(outcome.status).toBe("scored");
    if (outcome.status === "scored") {
      expect(outcome.turnScore).toBe(75);
      expect(outcome.evaluation.criteria.depth.score).toBe(4);
      expect(outcome.evaluation.topFix).toContain("race conditions");
    }
  });

  it("retries on invalid provider output and marks unscored if retry fails (FR-012)", async () => {
    const errorProvider = {
      id: "openai-compatible",
      generateObject: async () => {
        return {
          ok: false,
          error: {
            kind: "invalid_output" as const,
            message: "Invalid JSON structure from model",
            retryable: true,
          },
        };
      },
    } as unknown as ProviderAdapter;

    const outcome = await evaluateAnswer({
      question: { text: "System design question", skillTags: ["system_design"], difficulty: 4 },
      answerText: "Candidate answer text",
      level: "senior",
      targetRole: "Staff Engineer",
      rubric: MOCK_MID_RUBRIC,
      provider: errorProvider,
    });

    expect(outcome.status).toBe("unscored");
    if (outcome.status === "unscored") {
      expect(outcome.error).toBeDefined();
    }
  });
});

describe("Grounded Rewrite Generator (FR-013, AI-005, AI-021)", () => {
  it("detects ungrounded enterprise company claims absent from profile", () => {
    const rewriteWithHallucination =
      "At Netflix, I led the migration of a distributed Redis cache handling 10M RPS.";
    const validation = validateGrounding(rewriteWithHallucination, MOCK_PROFILE);

    expect(validation.isGrounded).toBe(false);
    expect(validation.unsupportedClaims.length).toBeGreaterThan(0);
    expect(validation.unsupportedClaims[0]).toContain("Netflix");
  });

  it("passes validation when rewrite only references profile skills and company", () => {
    const groundedRewrite =
      "At Acme Corp, I designed our backend services using TypeScript and PostgreSQL, caching hot queries in Redis.";
    const validation = validateGrounding(groundedRewrite, MOCK_PROFILE);

    expect(validation.isGrounded).toBe(true);
    expect(validation.unsupportedClaims.length).toBe(0);
    expect(validation.supportedFacts.length).toBeGreaterThanOrEqual(3);
  });

  it("generates deterministic grounded rewrite referencing candidate profile facts", async () => {
    const rewrite = await generateGroundedRewrite({
      questionText: "How do you handle high throughput caching?",
      originalAnswer: "I use Redis for caching.",
      level: "mid",
      targetRole: "Backend Engineer",
      profile: MOCK_PROFILE,
    });

    expect(rewrite.rewrittenAnswer).toContain("Backend Engineer");
    expect(rewrite.rewrittenAnswer).toContain("TypeScript");
    expect(rewrite.unsupportedClaims.length).toBe(0);
    expect(rewrite.improvementSummary).toBeDefined();
  });
});

describe("Session Scorecard Aggregator (FR-013, FR-014)", () => {
  const mockSession: SessionRow = {
    id: "session-123",
    startedAt: "2026-10-16T10:00:00Z",
    endedAt: "2026-10-16T10:20:00Z",
    status: "completed",
    plan: { length: 2, level: "mid", inputMode: "voice" },
    modality: "voice",
    level: "mid",
    providerId: "test-provider",
    modelId: "test-model",
    schemaVersion: 1,
  };

  const mockTurns: TurnRow[] = [
    {
      id: "turn-1",
      sessionId: "session-123",
      index: 0,
      isUnverifiedQuestion: false,
      skillTags: ["backend_apis", "databases"],
      difficulty: 0.5,
      questionText: "Explain idempotency",
      answerText: "Answer 1",
      status: "scored",
      evaluation: {
        criteria: {
          relevance: { score: 4, reason: "Good", evidence: "idempotency" },
          structure: { score: 4, reason: "Good", evidence: "step 1" },
          depth: { score: 3, reason: "Acceptable", evidence: "DB check" },
          clarity: { score: 4, reason: "Good", evidence: "clear" },
          levelFit: { score: 4, reason: "Good", evidence: "fit" },
        },
        skillScores: { backend_apis: 70, databases: 70 },
        topFix: "Discuss atomic lock timeouts in Redis.",
        unsupportedClaims: [],
      },
      delivery: {
        wordsPerMinute: 130,
        fillerWordCount: 3,
        pauseSeconds: 1.5,
        answerLengthWords: 65,
      },
    },
    {
      id: "turn-2",
      sessionId: "session-123",
      index: 1,
      isUnverifiedQuestion: false,
      skillTags: ["databases"],
      difficulty: 0.6,
      questionText: "Explain DB indexing",
      answerText: "Answer 2",
      status: "scored",
      evaluation: {
        criteria: {
          relevance: { score: 5, reason: "Direct", evidence: "B-Tree" },
          structure: { score: 4, reason: "Good", evidence: "flow" },
          depth: { score: 5, reason: "Thorough", evidence: "composite index" },
          clarity: { score: 4, reason: "Good", evidence: "clear" },
          levelFit: { score: 5, reason: "High fit", evidence: "p99 latency" },
        },
        skillScores: { databases: 90 },
        topFix: "Highlight table write amplification costs.",
        unsupportedClaims: [],
      },
      delivery: {
        wordsPerMinute: 140,
        fillerWordCount: 1,
        pauseSeconds: 1.0,
        answerLengthWords: 70,
      },
    },
  ];

  it("computes overall score and criterion averages accurately", () => {
    const scorecard = computeSessionScorecard(mockSession, mockTurns);

    expect(scorecard.sessionId).toBe("session-123");
    expect(scorecard.isPartial).toBe(false);
    expect(scorecard.scoredTurnsCount).toBe(2);
    expect(scorecard.unscoredTurnsCount).toBe(0);
    // Turn 1 score = ((3.8 - 1)/4)*100 = 70. Turn 2 score = ((4.6 - 1)/4)*100 = 90. Avg = 80.
    expect(scorecard.overallScore).toBe(80);

    const relevance = scorecard.criterionAverages.find((c) => c.key === "relevance");
    expect(relevance?.score).toBe(4.5);

    const depth = scorecard.criterionAverages.find((c) => c.key === "depth");
    expect(depth?.score).toBe(4.0);

    expect(scorecard.topThreeFixes.length).toBeGreaterThanOrEqual(2);
    expect(scorecard.topThreeFixes[0]).toBe("Discuss atomic lock timeouts in Redis.");
  });

  it("computes delivery averages for voice sessions and omits them for text sessions", () => {
    const voiceScorecard = computeSessionScorecard(mockSession, mockTurns);
    expect(voiceScorecard.deliveryAverages).toBeDefined();
    expect(voiceScorecard.deliveryAverages?.averageWordsPerMinute).toBe(135);
    expect(voiceScorecard.deliveryAverages?.totalFillerWordCount).toBe(4);

    const textSession: SessionRow = { ...mockSession, modality: "text" };
    const textScorecard = computeSessionScorecard(textSession, mockTurns);
    expect(textScorecard.deliveryAverages).toBeUndefined();
  });

  it("flags partial session when fewer turns completed than planned", () => {
    const partialTurns = [mockTurns[0]!]; // Only 1 of 2 turns completed
    const partialScorecard = computeSessionScorecard(mockSession, partialTurns);
    expect(partialScorecard.isPartial).toBe(true);
  });
});
