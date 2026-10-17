// FR-004, FR-017, architecture.md 8 & 9: Core unit tests for calibration level bands,
// adaptive difficulty stepping, and resume-versus-level note detection.

import { describe, expect, it } from "vitest";
import {
  LEVEL_BANDS,
  LEVEL_ORDER,
  computeAdaptiveDifficulty,
  detectResumeLevel,
  difficultyBankToNorm,
  generateResumeVersusLevelNote,
  normToDifficultyBank,
} from "./level-bands.js";
import {
  createInitialInterviewState,
  interviewReducer,
  type ActiveQuestion,
  type CompletedTurn,
} from "../interview/state-machine.js";
import { computeSessionScorecard } from "../evaluation/scorecard.js";
import type { Evaluation } from "../schemas/evaluation.schema.js";
import type { StructuredProfile } from "../schemas/profile.schema.js";
import type { SelectedQuestion, SessionPlan } from "../schemas/session.schema.js";
import type { SessionRow, TurnRow } from "../schemas/storage-rows.schema.js";

function createMockTurn(options: {
  turnScore?: number;
  levelFit?: number;
  depth?: number;
  status?: "scored" | "unscored";
}): CompletedTurn {
  const status = options.status ?? "scored";
  const levelFit = options.levelFit ?? 3;
  const depth = options.depth ?? 3;
  const s =
    options.turnScore !== undefined
      ? Math.min(5, Math.max(1, Math.round((options.turnScore / 100) * 4 + 1)))
      : 3;

  const evaluation: Evaluation | undefined =
    status === "scored"
      ? {
          criteria: {
            relevance: { score: s as 1 | 2 | 3 | 4 | 5, reason: "Relevance", evidence: "Evidence" },
            structure: { score: s as 1 | 2 | 3 | 4 | 5, reason: "Structure", evidence: "Evidence" },
            depth: { score: depth as 1 | 2 | 3 | 4 | 5, reason: "Depth", evidence: "Evidence" },
            clarity: { score: s as 1 | 2 | 3 | 4 | 5, reason: "Clarity", evidence: "Evidence" },
            levelFit: { score: levelFit as 1 | 2 | 3 | 4 | 5, reason: "Fit", evidence: "Evidence" },
          },
          skillScores: { dsa: options.turnScore ?? 60 },
          topFix: "Discuss trade-offs proactively.",
          unsupportedClaims: [],
        }
      : undefined;

  return {
    id: "turn-test-1",
    index: 0,
    questionId: "q-test-1",
    isUnverifiedQuestion: false,
    skillTags: ["dsa"],
    difficulty: 0.5,
    questionText: "Sample question?",
    answerText: "Sample answer.",
    status,
    evaluation,
  };
}

describe("Core Calibration Engine (FR-017, FR-004)", () => {
  describe("Level Bands & Difficulty Ranges (FR-017, architecture.md 9)", () => {
    it("defines 5 canonical levels with non-empty descriptions and 5 calibration axes", () => {
      expect(LEVEL_ORDER).toHaveLength(5);
      for (const level of LEVEL_ORDER) {
        const band = LEVEL_BANDS[level];
        expect(band).toBeDefined();
        expect(band.level).toBe(level);
        expect(band.difficultyRange[0]).toBeGreaterThanOrEqual(1);
        expect(band.difficultyRange[1]).toBeLessThanOrEqual(5);
        expect(band.difficultyRange[0]).toBeLessThanOrEqual(band.difficultyRange[1]);
        expect(band.defaultDifficulty).toBeGreaterThanOrEqual(band.difficultyRange[0]);
        expect(band.defaultDifficulty).toBeLessThanOrEqual(band.difficultyRange[1]);

        // Five calibration axes (FR-017)
        expect(band.axes.depth).toBeTruthy();
        expect(band.axes.ambiguity).toBeTruthy();
        expect(band.axes.expectedScope).toBeTruthy();
        expect(band.axes.followUpPressure).toBeTruthy();
        expect(band.axes.behavioralExpectations).toBeTruthy();
      }
    });

    it("correctly converts between integer bank difficulty and normalized difficulty", () => {
      expect(difficultyBankToNorm(1)).toBe(0.0);
      expect(difficultyBankToNorm(2)).toBe(0.25);
      expect(difficultyBankToNorm(3)).toBe(0.5);
      expect(difficultyBankToNorm(4)).toBe(0.75);
      expect(difficultyBankToNorm(5)).toBe(1.0);

      expect(normToDifficultyBank(0.0)).toBe(1);
      expect(normToDifficultyBank(0.25)).toBe(2);
      expect(normToDifficultyBank(0.5)).toBe(3);
      expect(normToDifficultyBank(0.75)).toBe(4);
      expect(normToDifficultyBank(1.0)).toBe(5);
    });
  });

  describe("Adaptive Difficulty Stepping within Level Band (FR-017, architecture.md 8)", () => {
    it("steps difficulty up by at most +1 when answer score is strong (>= 75%)", () => {
      const turn = createMockTurn({ turnScore: 85, levelFit: 4, depth: 4 });
      const nextD = computeAdaptiveDifficulty(2, turn, "junior"); // Junior range is [1, 3]
      expect(nextD).toBe(3);
    });

    it("steps difficulty down by at most -1 when candidate struggles (<= 45%)", () => {
      const turn = createMockTurn({ turnScore: 35, levelFit: 2, depth: 2 });
      const nextD = computeAdaptiveDifficulty(2, turn, "junior");
      expect(nextD).toBe(1);
    });

    it("maintains difficulty when performance is steady (between 46% and 74%)", () => {
      const turn = createMockTurn({ turnScore: 60, levelFit: 3, depth: 3 });
      const nextD = computeAdaptiveDifficulty(2, turn, "junior");
      expect(nextD).toBe(2);
    });

    it("clamps adaptive difficulty strictly to the level band boundaries", () => {
      // Fresher range is [1, 2]
      const highTurn = createMockTurn({ turnScore: 95, levelFit: 5, depth: 5 });
      expect(computeAdaptiveDifficulty(2, highTurn, "intern_fresher")).toBe(2);

      const lowTurn = createMockTurn({ turnScore: 20, levelFit: 1, depth: 1 });
      expect(computeAdaptiveDifficulty(1, lowTurn, "intern_fresher")).toBe(1);

      // Senior range is [3, 5]
      expect(computeAdaptiveDifficulty(5, highTurn, "senior")).toBe(5);
      expect(computeAdaptiveDifficulty(3, lowTurn, "senior")).toBe(3);
    });

    it("leaves difficulty unchanged if the turn was unscored (skipped or expired)", () => {
      const unscoredTurn = createMockTurn({ status: "unscored" });
      const nextD = computeAdaptiveDifficulty(3, unscoredTurn, "mid");
      expect(nextD).toBe(3);
    });
  });

  describe("Adaptive Difficulty in Interview State Machine (FR-017, architecture.md 8)", () => {
    it("re-orders remaining questions on NEXT to select candidate matching adapted difficulty", () => {
      const plan: SessionPlan = {
        sessionId: "session-adapt-1",
        level: "junior", // range [1, 3], default 2
        targetRole: "Full Stack Engineer",
        type: "technical",
        length: 5,
        style: "standard",
        inputMode: "text",
        createdAt: new Date().toISOString(),
      };

      const questions: SelectedQuestion[] = [
        {
          id: "q-1",
          bankId: "q-1",
          isUnverified: false,
          skillTags: ["dsa"],
          difficulty: 0.25, // difficulty 2
          text: "Question 1 (Diff 2)",
        },
        {
          id: "q-2-low",
          bankId: "q-2-low",
          isUnverified: false,
          skillTags: ["dsa"],
          difficulty: 0.0, // difficulty 1
          text: "Question 2 (Diff 1)",
        },
        {
          id: "q-3-high",
          bankId: "q-3-high",
          isUnverified: false,
          skillTags: ["dsa"],
          difficulty: 0.5, // difficulty 3
          text: "Question 3 (Diff 3)",
        },
      ];

      const initial = createInitialInterviewState(plan, questions);
      expect(initial.context.currentDifficulty).toBe(2);

      // Start interview and simulate high score on Question 1
      const s1 = interviewReducer(initial, { type: "START" });
      const s2 = interviewReducer(s1.state, { type: "INTRO_DONE" });
      const activeQ: ActiveQuestion = {
        id: "q-1",
        text: "Question 1",
        difficulty: 0.25,
        skillTags: ["dsa"],
        isUnverified: false,
        followUpCount: 0,
      };
      const s3 = interviewReducer(s2.state, { type: "QUESTION_READY", question: activeQ });
      const s4 = interviewReducer(s3.state, { type: "SUBMIT", answerText: "Masterful answer" });

      const scoredEvaluation: Evaluation = {
        criteria: {
          relevance: { score: 5, reason: "Excellent", evidence: "Evidence" },
          structure: { score: 5, reason: "Excellent", evidence: "Evidence" },
          depth: { score: 5, reason: "Excellent", evidence: "Evidence" },
          clarity: { score: 5, reason: "Excellent", evidence: "Evidence" },
          levelFit: { score: 5, reason: "Excellent", evidence: "Evidence" },
        },
        skillScores: { dsa: 100 },
        topFix: "Keep up the excellent communication.",
        unsupportedClaims: [],
      };
      const s5 = interviewReducer(s4.state, { type: "SCORED", evaluation: scoredEvaluation });

      // Dispatch NEXT -> should adapt difficulty to 3, and promote q-3-high (difficulty 3) ahead of q-2-low (difficulty 1)
      const nextTransition = interviewReducer(s5.state, { type: "NEXT" });
      expect(nextTransition.state.context.currentDifficulty).toBe(3);
      expect(nextTransition.state.context.currentQuestion?.id).toBe("q-3-high");
    });
  });

  describe("Resume-versus-Level Note (FR-004, FR-017)", () => {
    it("detects experience level from profile based on explicit claims or role titles", () => {
      const seniorProfile: StructuredProfile = {
        id: "prof-sen",
        inputHash: "hash-sen",
        condensed: "Senior software engineer with 6 years experience.",
        skills: ["TypeScript", "Distributed Systems", "PostgreSQL"],
        experiences: [
          {
            role: "Senior Software Engineer",
            company: "Tech Corp",
            highlights: ["Led distributed payment migration", "6 years of professional experience"],
          },
        ],
        promptVersion: 1,
      };

      const detected = detectResumeLevel(seniorProfile);
      expect(detected).not.toBeNull();
      expect(detected?.detectedLevel).toBe("senior");
      expect(detected?.estimatedYears).toBe(6);
    });

    it("generates a gentle note when user practices at Senior level with Intern/Fresher resume evidence", () => {
      const fresherProfile: StructuredProfile = {
        id: "prof-fresher",
        inputHash: "hash-fresher",
        condensed: "Computer science student with 0 years experience.",
        skills: ["Python", "Algorithms"],
        experiences: [
          {
            role: "Software Engineering Intern",
            company: "University Lab",
            highlights: ["Built campus club website"],
          },
        ],
        promptVersion: 1,
      };

      const note = generateResumeVersusLevelNote("senior", fresherProfile);
      expect(note).not.toBeNull();
      expect(note).toContain("Senior");
      expect(note).toContain("Junior");
    });

    it("generates a gentle note when user practices at Intern level with Senior resume evidence", () => {
      const seniorProfile: StructuredProfile = {
        id: "prof-sr",
        inputHash: "hash-sr",
        condensed: "Senior architect with 8 years experience.",
        skills: ["Cloud Architecture", "Distributed Systems"],
        experiences: [
          {
            role: "Lead Systems Architect",
            company: "Enterprise Cloud",
            highlights: ["8+ years of experience scaling distributed pipelines"],
          },
        ],
        promptVersion: 1,
      };

      const note = generateResumeVersusLevelNote("intern_fresher", seniorProfile);
      expect(note).not.toBeNull();
      expect(note).toContain("Intern");
      expect(note).toMatch(/(Senior|Staff\+)/);
    });

    it("returns null when selected level is within 1 band of detected level (normal variance)", () => {
      const midProfile: StructuredProfile = {
        id: "prof-mid",
        inputHash: "hash-mid",
        condensed: "Mid-level backend engineer.",
        skills: ["Node.js", "Docker", "PostgreSQL"],
        experiences: [
          {
            role: "Software Engineer",
            company: "Startup",
            highlights: ["4 years experience building REST APIs"],
          },
        ],
        promptVersion: 1,
      };

      // Detected is "mid" (4 years). Both "junior" (1 step away) and "senior" (1 step away) are normal variance.
      expect(generateResumeVersusLevelNote("junior", midProfile)).toBeNull();
      expect(generateResumeVersusLevelNote("mid", midProfile)).toBeNull();
      expect(generateResumeVersusLevelNote("senior", midProfile)).toBeNull();
    });

    it("includes resumeVersusLevelNote in computeSessionScorecard when profile is provided", () => {
      const fresherProfile: StructuredProfile = {
        id: "prof-fr",
        inputHash: "hash-fr",
        condensed: "Intern developer.",
        skills: ["HTML", "JavaScript"],
        experiences: [
          {
            role: "Frontend Intern",
            company: "College",
            highlights: ["Student project"],
          },
        ],
        promptVersion: 1,
      };

      const session: SessionRow = {
        id: "sess-test",
        startedAt: new Date().toISOString(),
        status: "completed",
        modality: "text",
        level: "senior",
        providerId: "mock",
        modelId: "mock-model",
        schemaVersion: 1,
      };

      const turns: TurnRow[] = [
        {
          id: "turn-1",
          sessionId: "sess-test",
          index: 0,
          isUnverifiedQuestion: false,
          skillTags: ["dsa"],
          difficulty: 0.75,
          questionText: "Question?",
          answerText: "Answer.",
          status: "scored",
          evaluation: {
            criteria: {
              relevance: { score: 3, reason: "ok", evidence: "ok" },
              structure: { score: 3, reason: "ok", evidence: "ok" },
              depth: { score: 3, reason: "ok", evidence: "ok" },
              clarity: { score: 3, reason: "ok", evidence: "ok" },
              levelFit: { score: 3, reason: "ok", evidence: "ok" },
            },
            skillScores: { dsa: 60 },
            topFix: "Fix",
            unsupportedClaims: [],
          },
        },
      ];

      const scorecard = computeSessionScorecard(session, turns, fresherProfile);
      expect(scorecard.resumeVersusLevelNote).toBeDefined();
      expect(scorecard.resumeVersusLevelNote).toContain("Senior");
    });
  });
});
