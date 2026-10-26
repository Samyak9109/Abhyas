// FR-012, FR-013, ADR-006, design.md 8 (PG-13): Tests for ResultsScreen.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import {
  MemoryStorageAdapter,
  MockProviderAdapter,
  type Evaluation,
  type ProviderRow,
  type SessionRow,
  type StructuredProfile,
  type TurnRow,
} from "@abhyas/core";
import { ResultsScreen } from "./ResultsScreen";

const mockEvaluation: Evaluation = {
  criteria: {
    relevance: {
      score: 4,
      reason: "Directly answered the trade-offs.",
      evidence: "Used scheduler.yield",
    },
    structure: { score: 4, reason: "Clear sequence.", evidence: "Diagnose then fix" },
    depth: {
      score: 5,
      reason: "Deep grasp of browser rendering engine.",
      evidence: "Long animation frames",
    },
    clarity: { score: 4, reason: "Concise and well-structured.", evidence: "Clear terminology" },
    levelFit: {
      score: 4,
      reason: "Solid mid-level delivery.",
      evidence: "Standard engineering approach",
    },
  },
  skillScores: { frontend: 80, performance: 80 },
  topFix: "Mention synthetic lab testing in CI before production telemetry.",
  unsupportedClaims: [],
};

const mockProfile: StructuredProfile = {
  id: "profile-1",
  inputHash: "hash12345",
  condensed:
    "Mid-level backend engineer experienced in TypeScript, PostgreSQL, and Redis at Acme Corp.",
  skills: ["TypeScript", "PostgreSQL", "Redis"],
  experiences: [
    {
      role: "Backend Engineer",
      company: "Acme Corp",
      highlights: ["Optimized database query performance by 40%"],
    },
  ],
  promptVersion: 1,
};

function createSeedData(modality: "voice" | "text" = "voice", isPartial = false) {
  const sessionId = "session-test-123";

  const session: SessionRow = {
    id: sessionId,
    startedAt: "2026-10-16T10:00:00Z",
    endedAt: "2026-10-16T10:25:00Z",
    status: isPartial ? "active" : "completed",
    plan: {
      sessionId,
      targetRole: "Full Stack Engineer",
      level: "mid",
      type: "technical",
    },
    modality,
    level: "mid",
    providerId: "openai-compatible",
    modelId: "gpt-4o-mini",
    schemaVersion: 1,
  };

  const turns: TurnRow[] = [
    {
      id: "turn-1",
      sessionId,
      index: 0,
      questionId: "q-1",
      questionText: "How do you diagnose and improve poor web performance?",
      answerText: "I inspect Chrome DevTools Performance panel and isolate long tasks.",
      isUnverifiedQuestion: false,
      skillTags: ["frontend", "performance"],
      difficulty: 0.5,
      delivery:
        modality === "voice"
          ? {
              wordsPerMinute: 130,
              fillerWordCount: 2,
              pauseSeconds: 3,
              answerLengthWords: 45,
            }
          : undefined,
      status: "scored",
      evaluation: mockEvaluation,
    },
  ];

  return { session, turns };
}

describe("M1.7: ResultsScreen (PG-13)", () => {
  it("renders session not found state when storage is empty", async () => {
    const storage = new MemoryStorageAdapter();
    render(
      <ResultsScreen
        storage={storage}
        sessionId="non-existent-id"
        onFinish={vi.fn()}
        onNavigateHome={vi.fn()}
      />
    );

    expect(await screen.findByText(/session not found/i)).toBeTruthy();
  });

  it("renders voice session scorecard with overall score, top fixes, and delivery metrics", async () => {
    const storage = new MemoryStorageAdapter();
    const { session, turns } = createSeedData("voice");

    await storage.put("sessions", session);
    for (const turn of turns) {
      await storage.put("turns", turn);
    }
    await storage.put("structuredProfiles", mockProfile);

    render(
      <ResultsScreen
        storage={storage}
        sessionId={session.id}
        onFinish={vi.fn()}
        onNavigateHome={vi.fn()}
      />
    );

    // Header and Score Chip
    expect(await screen.findByRole("heading", { name: /interview scorecard/i })).toBeTruthy();
    expect(screen.getByText("🎙 Voice Session")).toBeTruthy();
    expect(screen.getByText("Top Priority Fixes")).toBeTruthy();

    // Top fixes
    expect(
      screen.getByText("Mention synthetic lab testing in CI before production telemetry.")
    ).toBeTruthy();

    // Criteria breakdown
    expect(screen.getByText("Rubric Criteria Breakdown")).toBeTruthy();
    expect(screen.getAllByText(/Relevance & Directness/i).length).toBeGreaterThan(0);

    // Voice delivery metrics section present
    expect(screen.getByRole("heading", { name: /speech & delivery metrics/i })).toBeTruthy();
    expect(screen.getByText("130")).toBeTruthy(); // WPM
    expect(screen.getByText("Words Per Minute")).toBeTruthy();
  });

  it("omits speech and delivery metrics for text-only sessions cleanly", async () => {
    const storage = new MemoryStorageAdapter();
    const { session, turns } = createSeedData("text");

    await storage.put("sessions", session);
    for (const turn of turns) {
      await storage.put("turns", turn);
    }

    render(
      <ResultsScreen
        storage={storage}
        sessionId={session.id}
        onFinish={vi.fn()}
        onNavigateHome={vi.fn()}
      />
    );

    expect(await screen.findByRole("heading", { name: /interview scorecard/i })).toBeTruthy();
    expect(screen.getByText("⌨ Text Session")).toBeTruthy();

    // Delivery metrics heading should NOT exist for text session
    expect(screen.queryByRole("heading", { name: /speech & delivery metrics/i })).toBeNull();
  });

  it("displays partial session callout when session was ended early", async () => {
    const storage = new MemoryStorageAdapter();
    const { session, turns } = createSeedData("text", true);

    await storage.put("sessions", session);
    for (const turn of turns) {
      await storage.put("turns", turn);
    }

    render(
      <ResultsScreen
        storage={storage}
        sessionId={session.id}
        onFinish={vi.fn()}
        onNavigateHome={vi.fn()}
      />
    );

    expect(await screen.findByText(/partial session notice/i)).toBeTruthy();
  });

  it("switches to Per-Question tab and generates grounded rewrite on demand", async () => {
    const storage = new MemoryStorageAdapter();
    const { session, turns } = createSeedData("text");

    await storage.put("sessions", session);
    for (const turn of turns) {
      await storage.put("turns", turn);
    }
    await storage.put("structuredProfiles", mockProfile);

    render(
      <ResultsScreen
        storage={storage}
        sessionId={session.id}
        onFinish={vi.fn()}
        onNavigateHome={vi.fn()}
      />
    );

    expect(await screen.findByRole("heading", { name: /interview scorecard/i })).toBeTruthy();

    // Switch tab to Per-Question
    const perQuestionTab = screen.getByRole("tab", { name: /per-question/i });
    fireEvent.click(perQuestionTab);

    // View Question text and answer
    expect(screen.getByText("How do you diagnose and improve poor web performance?")).toBeTruthy();
    expect(
      screen.getByText("I inspect Chrome DevTools Performance panel and isolate long tasks.")
    ).toBeTruthy();

    // Click to generate grounded rewrite
    const rewriteBtn = screen.getByRole("button", { name: /view grounded rewrite/i });
    fireEvent.click(rewriteBtn);

    // Grounded rewrite should appear with profile facts
    expect(await screen.findByText(/grounded in verified profile facts/i)).toBeTruthy();
  });

  it("generates grounded rewrite using the active configured provider (finding 13)", async () => {
    const storage = new MemoryStorageAdapter();
    const { session, turns } = createSeedData("voice");

    await storage.put("sessions", session);
    for (const turn of turns) {
      await storage.put("turns", turn);
    }
    await storage.put("structuredProfiles", mockProfile);

    const mockCustomProvider = new MockProviderAdapter({
      mockObjectResponse: {
        rewrittenAnswer: "Custom tailored rewrite generated by active provider.",
        improvementSummary: "Elevated response with clear STAR methodology.",
        groundedFacts: ["Acme Corp", "TypeScript"],
        unsupportedClaims: [],
      },
    });

    render(
      <ResultsScreen
        storage={storage}
        sessionId={session.id}
        provider={mockCustomProvider}
        onFinish={vi.fn()}
        onNavigateHome={vi.fn()}
      />
    );

    expect(await screen.findByRole("heading", { name: /interview scorecard/i })).toBeTruthy();

    const perQuestionTab = screen.getByRole("tab", { name: /per-question/i });
    fireEvent.click(perQuestionTab);

    const rewriteBtn = screen.getByRole("button", { name: /view grounded rewrite/i });
    fireEvent.click(rewriteBtn);

    expect(
      await screen.findByText("Custom tailored rewrite generated by active provider.")
    ).toBeTruthy();
    expect(screen.getByText(/Elevated response with clear STAR methodology./)).toBeTruthy();
  });

  it("retrieves active provider from storage when not supplied as prop (finding 13)", async () => {
    const storage = new MemoryStorageAdapter();
    const { session, turns } = createSeedData("voice");

    await storage.put("sessions", session);
    for (const turn of turns) {
      await storage.put("turns", turn);
    }
    await storage.put("structuredProfiles", mockProfile);
    const mockProviderRow: ProviderRow = {
      id: "provider_1",
      kind: "mock",
      modelRoles: { interviewer: "mock-interviewer", evaluator: "mock-evaluator" },
    };
    await storage.put("providers", mockProviderRow);
    await storage.put("settings", { key: "activeProviderId", value: "provider_1" });

    render(
      <ResultsScreen
        storage={storage}
        sessionId={session.id}
        onFinish={vi.fn()}
        onNavigateHome={vi.fn()}
      />
    );

    expect(await screen.findByRole("heading", { name: /interview scorecard/i })).toBeTruthy();

    const perQuestionTab = screen.getByRole("tab", { name: /per-question/i });
    fireEvent.click(perQuestionTab);

    const rewriteBtn = screen.getByRole("button", { name: /view grounded rewrite/i });
    fireEvent.click(rewriteBtn);

    expect(await screen.findByText(/Stronger Answer/i)).toBeTruthy();
  });

  it("switches to Full Transcript tab and displays verbatim conversation", async () => {
    const storage = new MemoryStorageAdapter();
    const { session, turns } = createSeedData("text");

    await storage.put("sessions", session);
    for (const turn of turns) {
      await storage.put("turns", turn);
    }

    render(
      <ResultsScreen
        storage={storage}
        sessionId={session.id}
        onFinish={vi.fn()}
        onNavigateHome={vi.fn()}
      />
    );

    await screen.findByRole("heading", { name: /interview scorecard/i });

    const transcriptTab = screen.getByRole("tab", { name: /full transcript/i });
    fireEvent.click(transcriptTab);

    expect(screen.getByRole("heading", { name: /verbatim interview transcript/i })).toBeTruthy();
    expect(screen.getByText("Interviewer")).toBeTruthy();
    expect(screen.getByText("You")).toBeTruthy();
  });

  it("invokes onFinish when Finish button is clicked", async () => {
    const storage = new MemoryStorageAdapter();
    const { session, turns } = createSeedData("text");
    const onFinish = vi.fn();

    await storage.put("sessions", session);
    for (const turn of turns) {
      await storage.put("turns", turn);
    }

    render(
      <ResultsScreen
        storage={storage}
        sessionId={session.id}
        onFinish={onFinish}
        onNavigateHome={vi.fn()}
      />
    );

    await screen.findByRole("heading", { name: /interview scorecard/i });

    const finishBtn = screen.getByRole("button", { name: /finish & return home/i });
    fireEvent.click(finishBtn);

    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  describe("Accessibility (axe)", () => {
    it("has zero axe violations under Ink theme", async () => {
      const storage = new MemoryStorageAdapter();
      const { session, turns } = createSeedData("voice");

      await storage.put("sessions", session);
      for (const turn of turns) {
        await storage.put("turns", turn);
      }
      await storage.put("structuredProfiles", mockProfile);

      const { container } = render(
        <div data-theme="ink">
          <ResultsScreen
            storage={storage}
            sessionId={session.id}
            onFinish={vi.fn()}
            onNavigateHome={vi.fn()}
          />
        </div>
      );

      await screen.findByRole("heading", { name: /interview scorecard/i });

      const results = await axe(container);
      expect(results.violations).toEqual([]);
    });

    it("renders Experience Calibration Note when selected level differs from resume profile (FR-004, FR-017)", async () => {
      const storage = new MemoryStorageAdapter();
      const { session, turns } = createSeedData("text");
      // Session level is "senior", but profile is intern
      const seniorSession: SessionRow = {
        ...session,
        level: "senior",
      };
      const internProfile: StructuredProfile = {
        id: "prof-intern",
        inputHash: "hash-intern",
        condensed: "Intern student developer.",
        skills: ["HTML", "CSS"],
        experiences: [
          {
            role: "Software Engineering Intern",
            company: "College Lab",
            highlights: ["Student course project"],
          },
        ],
        promptVersion: 1,
      };

      await storage.put("sessions", seniorSession);
      for (const turn of turns) {
        await storage.put("turns", turn);
      }
      await storage.put("structuredProfiles", internProfile);

      render(
        <ResultsScreen
          storage={storage}
          sessionId={seniorSession.id}
          onFinish={vi.fn()}
          onNavigateHome={vi.fn()}
        />
      );

      await screen.findByRole("heading", { name: /interview scorecard/i });
      expect(screen.getByText(/Experience Calibration Note/i)).toBeDefined();
      expect(screen.getByText(/Senior.*level/i)).toBeDefined();
    });

    it("has zero axe violations under Paper theme", async () => {
      const storage = new MemoryStorageAdapter();
      const { session, turns } = createSeedData("voice");

      await storage.put("sessions", session);
      for (const turn of turns) {
        await storage.put("turns", turn);
      }
      await storage.put("structuredProfiles", mockProfile);

      const { container } = render(
        <div data-theme="paper">
          <ResultsScreen
            storage={storage}
            sessionId={session.id}
            onFinish={vi.fn()}
            onNavigateHome={vi.fn()}
          />
        </div>
      );

      await screen.findByRole("heading", { name: /interview scorecard/i });

      const results = await axe(container);
      expect(results.violations).toEqual([]);
    });

    it("renders Basic Feedback badge and honesty callout for small local model session with zero axe violations (FR-012, AI-014, PG-13)", async () => {
      const storage = new MemoryStorageAdapter();
      const { session, turns } = createSeedData("text");
      const localSession: SessionRow = {
        ...session,
        providerId: "webllm",
        modelId: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
      };
      const basicTurns: TurnRow[] = turns.map((t) => ({
        ...t,
        evaluation: {
          ...t.evaluation!,
          isBasic: true,
        },
      }));

      await storage.put("sessions", localSession);
      for (const turn of basicTurns) {
        await storage.put("turns", turn);
      }
      await storage.put("structuredProfiles", mockProfile);

      const { container } = render(
        <div data-theme="ink">
          <ResultsScreen
            storage={storage}
            sessionId={localSession.id}
            onFinish={vi.fn()}
            onNavigateHome={vi.fn()}
          />
        </div>
      );

      await screen.findByRole("heading", { name: /interview scorecard/i });

      // Check Basic Feedback badge and Callout banner
      expect(screen.getByText("Basic Feedback")).toBeDefined();
      expect(screen.getByText("Basic Feedback Mode")).toBeDefined();
      expect(screen.getByText(/deterministic rule-based checks/i)).toBeDefined();
      expect(screen.getByText("Basic Score")).toBeDefined();

      const results = await axe(container);
      expect(results.violations).toEqual([]);
    });
  });
});
