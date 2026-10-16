// FR-005, FR-006, FR-008, FR-011, FR-012, FR-013, NFR-009, NFR-011
// M1.8: Comprehensive End-to-End Interview Journey and Hardening Suite.
// Verifies full candidate lifecycle: setup -> interview -> turns -> scoring -> scorecard -> recovery.

import { describe, expect, it } from "vitest";
import {
  calculateDeliveryMetrics,
  computeSessionScorecard,
  generateGroundedRewrite,
  MemoryStorageAdapter,
  MockProviderAdapter,
  selectQuestions,
  SessionPlanSchema,
  SessionRunner,
  validateGrounding,
  type ProviderRow,
  type SelectedQuestion,
  type SessionPlan,
  type SessionRow,
  type StructuredProfile,
  type TurnRow,
} from "../packages/core/src/index.js";
import { SAMPLE_QUESTION_BANK } from "../packages/content/src/index.js";

describe("M1.8: End-to-End Candidate Interview Journey (FR-005 to FR-013)", () => {
  it("executes the complete candidate interview flow from setup to scorecard and grounded rewrite", async () => {
    const storage = new MemoryStorageAdapter();
    const sessionId = "e2e-session-full-journey-101";

    // 1. Setup AI Provider
    const providerRow: ProviderRow = {
      id: "gemini",
      kind: "gemini",
      key: "test-gemini-key",
      modelRoles: {
        interviewer: "gemini-2.0-flash",
        evaluator: "gemini-2.0-flash",
      },
      createdAt: new Date().toISOString(),
    };
    await storage.put("providers", providerRow);

    // 2. Setup Candidate Profile
    const candidateProfile: StructuredProfile = {
      condensed:
        "Senior Frontend Engineer with 7 years experience specializing in React architecture, TypeScript, Webpack, and web performance optimization.",
      experiences: [
        {
          role: "Staff Frontend Architect",
          company: "Nexus Systems",
          highlights: [
            "Reduced critical bundle size by 45% using code splitting and lazy loading",
            "Architected design system adopted by 12 engineering teams",
            "Mentored 6 junior engineers and established automated CI quality gates",
          ],
        },
      ],
      skills: ["React", "TypeScript", "Vite", "Performance", "System Architecture", "CSS"],
      projects: ["High-performance dashboard rendering 60fps real-time data grids"],
      extractedAt: new Date().toISOString(),
      sourceHash: "e2e-hash-abc-123",
    };
    await storage.put("structuredProfiles", { id: "active", ...candidateProfile });

    // 3. Configure Session Plan
    const plan: SessionPlan = SessionPlanSchema.parse({
      sessionId,
      type: "mixed",
      length: 5,
      style: "standard",
      level: "senior",
      targetRole: "Senior Frontend Engineer",
      inputMode: "text",
      createdAt: new Date().toISOString(),
    });

    // 4. Question Engine Selection
    const selectResult = await selectQuestions({
      plan,
      bank: SAMPLE_QUESTION_BANK,
      profile: candidateProfile,
    });

    expect(selectResult.questions.length).toBe(5);
    expect(selectResult.bankTracedCount).toBeGreaterThanOrEqual(4);

    // 5. Initialize Mock Provider for Evaluation and Follow-ups
    const mockProvider = new MockProviderAdapter({
      mockObjectResponse: {
        criteria: {
          relevance: {
            score: 4,
            reason: "Directly answered the core architectural question.",
            evidence: "dynamic code splitting via React lazy",
          },
          structure: {
            score: 4,
            reason: "Structured with STAR format and clear trade-offs.",
            evidence: "reduced initial JS load to 210KB",
          },
          depth: {
            score: 5,
            reason: "Deep dive into bundle splitting and chunking strategies.",
            evidence: "splitting vendor libraries",
          },
          clarity: {
            score: 4,
            reason: "Clear concise communication without filler.",
            evidence: "In our core application at Nexus",
          },
          levelFit: {
            score: 4,
            reason: "Demonstrated senior-level architectural thinking.",
            evidence: "cutting LCP by 45%",
          },
        },
        skillScores: {
          React: 88,
          Performance: 92,
        },
        topFix: "Could mention HTTP/2 multiplexing implications",
        unsupportedClaims: [],
      },
    });

    // 6. Start Live Interview State Machine
    const runner = new SessionRunner({
      plan,
      questions: selectResult.questions,
      storage,
      provider: mockProvider,
      autoStart: false,
    });

    await runner.dispatch({ type: "START" });

    expect(runner.getState().status).toBe("await_answer");
    expect(runner.getState().context.currentQuestionIndex).toBe(0);

    // --- Turn 1: Regular answer submission ---
    const q1 = selectResult.questions[0]!;
    await runner.dispatch({
      type: "SUBMIT",
      answerText:
        "In our core application at Nexus, we identified that initial bundle size was 1.2MB, slowing first paint on mobile devices. I configured dynamic code splitting via React lazy and Vite manualChunks, splitting vendor libraries and deferring heavy chart libraries. This reduced initial JS load to 210KB, cutting LCP by 45%.",
    });

    expect(runner.getState().context.turns.length).toBe(1);
    const turn1 = runner.getState().context.turns[0]!;
    expect(turn1.status).toBe("scored");
    expect(turn1.evaluation?.criteria.relevance.score).toBe(4);

    // Verify local delivery metrics computation (FR-012 voice & delivery metrics)
    const metrics = calculateDeliveryMetrics({
      answerText: turn1.answerText,
      durationSeconds: 35,
      pauseSeconds: 2,
    });
    expect(metrics.answerLengthWords).toBeGreaterThan(30);
    expect(metrics.wordsPerMinute).toBeGreaterThan(40);
    expect(metrics.fillerWordCount).toBeGreaterThanOrEqual(0);

    // --- Turn 2: Candidate requests a hint, then submits answer ---
    expect(runner.getState().status).toBe("await_answer");
    await runner.dispatch({ type: "HINT" });
    expect(runner.getState().context.hintText).toBeTruthy();

    await runner.dispatch({
      type: "SUBMIT",
      answerText:
        "When handling state synchronization across micro-frontends, we avoided global window variables and instead designed an event-driven pub/sub bus using native CustomEvents with strict TypeScript schemas. This isolated failure domains effectively.",
    });
    expect(runner.getState().context.turns.length).toBe(2);

    // --- Turn 3: Candidate pauses session, resumes, then skips question ---
    await runner.dispatch({ type: "PAUSE" });
    expect(runner.getState().status).toBe("paused");

    await runner.dispatch({ type: "RESUME" });
    expect(runner.getState().status).toBe("await_answer");

    await runner.dispatch({ type: "SKIP" });
    expect(runner.getState().context.turns.length).toBe(3);
    const turn3 = runner.getState().context.turns[2]!;
    expect(turn3.answerText).toBe("[Skipped]");
    expect(turn3.status).toBe("unscored");

    // --- Turn 4: Candidate answers next question ---
    await runner.dispatch({
      type: "SUBMIT",
      answerText:
        "For CSS architecture at scale, we adopted CSS Modules with standardized design tokens. All colors, spacing, and font sizes reference semantic CSS custom properties, ensuring zero runtime CSS-in-JS overhead.",
    });
    expect(runner.getState().context.turns.length).toBe(4);

    // --- Turn 5: Final question submission and session wrap-up ---
    await runner.dispatch({
      type: "SUBMIT",
      answerText:
        "To prevent regressions in performance, we established Lighthouse CI and bundle size check budgets in GitHub Actions. PRs adding more than 10KB to the critical path fail CI automatically.",
    });

    // Session completed and transitioned to results
    expect(runner.getState().status).toBe("results");

    // 7. Verify Data Integrity in Storage (NFR-009)
    const storedSession = await storage.get<SessionRow>("sessions", sessionId);
    expect(storedSession).toBeDefined();
    expect(storedSession?.status).toBe("completed");

    const allTurns = await storage.getAll<TurnRow>("turns");
    const sessionTurns = allTurns.filter((t) => t.sessionId === sessionId);
    expect(sessionTurns.length).toBe(5);

    // 8. Generate Session Scorecard (FR-012, PG-13)
    const scorecard = computeSessionScorecard(storedSession!, sessionTurns);
    expect(scorecard.overallScore).toBeGreaterThanOrEqual(0);
    expect(scorecard.overallScore).toBeLessThanOrEqual(100);
    expect(scorecard.topThreeFixes.length).toBeGreaterThan(0);
    expect(scorecard.skillSummaries.length).toBeGreaterThan(0);
    expect(scorecard.level).toBe("senior");
    expect(scorecard.criterionAverages.length).toBe(5);

    // 9. Generate Grounded Rewrite for Turn 1 (FR-013)
    const rewrite = await generateGroundedRewrite({
      questionText: q1.text,
      originalAnswer: turn1.answerText,
      level: "senior",
      targetRole: "Senior Frontend Engineer",
      profile: candidateProfile,
    });

    expect(rewrite.rewrittenAnswer.length).toBeGreaterThan(50);
    expect(rewrite.improvementSummary.length).toBeGreaterThan(0);

    // Anti-hallucination check (zero unbacked claims)
    const groundingCheck = validateGrounding(rewrite.rewrittenAnswer, candidateProfile);
    expect(groundingCheck.isGrounded).toBe(true);
    expect(groundingCheck.unsupportedClaims.length).toBe(0);
  });

  it("handles provider recoverable error and preserves completed turns without crashing (NFR-009)", async () => {
    const storage = new MemoryStorageAdapter();
    const sessionId = "e2e-session-error-recovery-102";

    const plan: SessionPlan = SessionPlanSchema.parse({
      sessionId,
      type: "technical",
      length: 5,
      style: "strict",
      level: "mid",
      targetRole: "Frontend Engineer",
      inputMode: "text",
      createdAt: new Date().toISOString(),
    });

    const questions: SelectedQuestion[] = [
      {
        id: "q-rec-1",
        bankQuestionId: "b-1",
        text: "Explain how React reconciles virtual DOM trees.",
        difficulty: 3,
        skillTags: ["React"],
        category: "technical",
      },
      {
        id: "q-rec-2",
        bankQuestionId: "b-2",
        text: "What are trade-offs of server-side rendering?",
        difficulty: 3,
        skillTags: ["Architecture"],
        category: "technical",
      },
    ];

    // Failing mock provider to trigger recovery
    const failingProvider = new MockProviderAdapter({
      shouldFailOnCall: true,
      errorToThrow: {
        kind: "timeout",
        message: "Provider gateway timed out after 30 seconds",
        retryable: true,
      },
    });

    const runner = new SessionRunner({
      plan,
      questions,
      storage,
      provider: failingProvider,
      autoStart: false,
    });

    await runner.dispatch({ type: "START" });

    expect(runner.getState().status).toBe("await_answer");

    // Candidate submits answer while provider is experiencing an outage
    await runner.dispatch({
      type: "SUBMIT",
      answerText: "React uses a heuristic O(n) algorithm comparing element types and keys.",
    });

    // In SessionRunner, an evaluation failure marks the turn unscored or enters recovery without crashing
    const state = runner.getState();
    expect(state.status === "await_answer" || state.status === "error_recoverable").toBe(true);

    // Save partial session
    await runner.dispatch({ type: "SAVE_PARTIAL" });

    // Verify partial session was saved in storage with abandoned status (NFR-009)
    const stored = await storage.get<SessionRow>("sessions", sessionId);
    expect(stored).toBeDefined();
    expect(stored?.status).toBe("abandoned");
  });

  it("operates entirely offline using rule-based scoring fallback and local storage (NFR-001, NFR-010)", async () => {
    const storage = new MemoryStorageAdapter();
    const sessionId = "e2e-session-offline-103";

    const plan: SessionPlan = SessionPlanSchema.parse({
      sessionId,
      type: "behavioral",
      length: 5,
      style: "friendly",
      level: "mid",
      targetRole: "Product Engineer",
      inputMode: "text",
      createdAt: new Date().toISOString(),
    });

    // Offline: zero provider, operates locally
    const runner = new SessionRunner({
      plan,
      questions: SAMPLE_QUESTION_BANK.slice(0, 5).map((q, idx) => ({
        id: `q-offline-${idx}`,
        bankQuestionId: q.id,
        text: q.text,
        difficulty: q.difficulty,
        skillTags: q.skillTags,
        category: q.type,
      })),
      storage,
      provider: undefined,
      autoStart: false,
    });

    await runner.dispatch({ type: "START" });
    expect(runner.getState().status).toBe("await_answer");

    // Submit answer in offline mode
    await runner.dispatch({
      type: "SUBMIT",
      answerText:
        "In our project, I handled conflicting priorities by creating an impact-effort matrix with stakeholders.",
    });

    expect(runner.getState().context.turns.length).toBe(1);
    const turn1 = runner.getState().context.turns[0]!;
    expect(turn1.status).toBe("scored");
    expect(turn1.evaluation).toBeDefined();

    // Verify scorecard works offline
    const sessionRow: SessionRow = {
      id: sessionId,
      plan,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      status: "completed",
      level: "mid",
      modality: "text",
      turnCount: 1,
    };
    const scorecard = computeSessionScorecard(sessionRow, [
      {
        id: turn1.id,
        sessionId,
        index: 0,
        skillTags: turn1.skillTags,
        difficulty: turn1.difficulty,
        questionText: turn1.questionText,
        answerText: turn1.answerText,
        status: turn1.status,
        evaluation: turn1.evaluation,
      },
    ]);

    expect(scorecard.overallScore).toBeGreaterThanOrEqual(0);
    expect(scorecard.overallScore).toBeLessThanOrEqual(100);
  });
});
