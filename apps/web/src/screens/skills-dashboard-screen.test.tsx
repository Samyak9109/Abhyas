// FR-015, design.md 8 & 9 (PG-15): Tests for SkillsDashboardScreen.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import {
  MemoryStorageAdapter,
  type SessionRow,
  type SkillStatRow,
  type TurnRow,
} from "@abhyas/core";
import { SkillsDashboardScreen } from "./SkillsDashboardScreen";

function createMockTurn(
  sessionId: string,
  index: number,
  skillTags: string[],
  score = 80,
  overrides: Partial<TurnRow> = {}
): TurnRow {
  const s = Math.min(5, Math.max(1, Math.round((score / 100) * 4 + 1))) as 1 | 2 | 3 | 4 | 5;
  const skillScores: Record<string, number> = {};
  for (const tag of skillTags) {
    skillScores[tag] = score;
  }

  return {
    id: `turn-${sessionId}-${index}`,
    sessionId,
    index,
    questionId: `q-${index}`,
    questionText: `Question ${index} for ${skillTags.join(", ")}`,
    answerText: `Detailed answer for question ${index}`,
    isUnverifiedQuestion: false,
    skillTags,
    difficulty: 0.6,
    status: "scored",
    evaluation: {
      criteria: {
        relevance: { score: s, reason: "Good", evidence: "Evidence text" },
        structure: { score: s, reason: "Good", evidence: "Evidence text" },
        depth: { score: s, reason: "Good", evidence: "Evidence text" },
        clarity: { score: s, reason: "Good", evidence: "Evidence text" },
        levelFit: { score: s, reason: "Good", evidence: "Evidence text" },
      },
      skillScores,
      topFix: "Address edge cases directly.",
      unsupportedClaims: [],
    },
    ...overrides,
  };
}

function createMockSession(
  id: string,
  startedAt: string,
  modality: "voice" | "text" = "voice"
): SessionRow {
  return {
    id,
    startedAt,
    endedAt: new Date(new Date(startedAt).getTime() + 15 * 60 * 1000).toISOString(),
    status: "completed",
    plan: {
      sessionId: id,
      targetRole: "Full Stack Engineer",
      level: "mid",
      type: "technical",
    },
    modality,
    level: "mid",
    providerId: "openai-compatible",
    modelId: "gpt-4o",
    schemaVersion: 1,
  };
}

describe("M2.3: SkillsDashboardScreen (PG-15, FR-015)", () => {
  describe("Zero Sessions / Empty State", () => {
    it("renders friendly empty state with mascot and practice CTA when no data exists", async () => {
      const storage = new MemoryStorageAdapter();
      const onStart = vi.fn();

      render(<SkillsDashboardScreen storage={storage} onStartSession={onStart} />);

      expect(await screen.findByRole("heading", { name: "Skills Dashboard_" })).toBeTruthy();
      expect(screen.getByText("No interview data yet")).toBeTruthy();
      expect(
        screen.getByText(/Complete an interview session to calibrate your technical/i)
      ).toBeTruthy();

      const startBtn = screen.getByRole("button", { name: /start practice session/i });
      expect(startBtn).toBeTruthy();
      fireEvent.click(startBtn);
      expect(onStart).toHaveBeenCalled();
    });
  });

  describe("One Session / Early Calibration State", () => {
    it("renders early calibration notice and low confidence tags for one-session users", async () => {
      const storage = new MemoryStorageAdapter();
      const session = createMockSession("session-1", "2026-10-16T12:00:00Z");
      const turn1 = createMockTurn("session-1", 0, ["dsa"], 70);
      const turn2 = createMockTurn("session-1", 1, ["system_design"], 60);

      await storage.put("sessions", session);
      await storage.put("turns", turn1);
      await storage.put("turns", turn2);

      render(<SkillsDashboardScreen storage={storage} />);

      // Guidance pill (FR-015 business logic)
      expect(
        await screen.findByText(/Results are guidance to help you prepare, not hiring verdicts/i)
      ).toBeTruthy();

      // Early calibration callout
      expect(screen.getByText(/Early Calibration \(1 session completed\)/i)).toBeTruthy();

      // Low confidence indicators
      const lowConfElements = screen.getAllByText(/Low confidence/i);
      expect(lowConfElements.length).toBeGreaterThan(0);
    });
  });

  describe("Many Sessions / Full Calibration Dashboard", () => {
    async function setupManySessionsStorage() {
      const storage = new MemoryStorageAdapter();

      // Profile with senior level
      const profile = {
        id: "active-profile",
        schemaVersion: 1 as const,
        experienceLevel: "senior" as const,
        targetRole: "Staff Software Engineer",
        skills: ["dsa", "system_design", "databases", "communication", "clarity"],
        verifiedSkills: ["dsa"],
        domainKnowledge: ["Distributed Systems"],
        yearsExperience: 8,
        roles: [],
        highlights: [],
        gaps: [],
      };
      await storage.put("structuredProfiles", profile);

      const session1 = createMockSession("s-1", "2026-10-01T10:00:00Z", "voice");
      const session2 = createMockSession("s-2", "2026-10-08T10:00:00Z", "voice");
      const session3 = createMockSession("s-3", "2026-10-15T10:00:00Z", "voice");

      await storage.put("sessions", session1);
      await storage.put("sessions", session2);
      await storage.put("sessions", session3);

      // Pre-seed 5 SkillStatRows to simulate calibrated history
      const stats: SkillStatRow[] = [
        {
          skillId: "dsa",
          score: 88,
          n: 12,
          confidence: "high",
          lastPracticedAt: "2026-10-15T10:30:00Z",
          trend: 4.2,
          taxonomyVersion: 1,
        },
        {
          skillId: "system_design",
          score: 42,
          n: 6,
          confidence: "medium",
          lastPracticedAt: "2026-10-08T10:30:00Z",
          trend: -3.5,
          taxonomyVersion: 1,
        },
        {
          skillId: "databases",
          score: 68,
          n: 4,
          confidence: "medium",
          lastPracticedAt: "2026-09-20T10:30:00Z", // Stale (> 14 days)
          taxonomyVersion: 1,
        },
        {
          skillId: "communication",
          score: 91,
          n: 8,
          confidence: "high",
          lastPracticedAt: "2026-10-15T10:30:00Z",
          trend: 1.0,
          taxonomyVersion: 1,
        },
        {
          skillId: "clarity",
          score: 76,
          n: 5,
          confidence: "medium",
          lastPracticedAt: "2026-10-15T10:30:00Z",
          taxonomyVersion: 1,
        },
      ];

      for (const st of stats) {
        await storage.put("skillStats", st);
      }

      // Add a couple of turns for inspect drawer
      await storage.put("turns", createMockTurn("s-1", 0, ["dsa"], 80));
      await storage.put("turns", createMockTurn("s-2", 0, ["dsa"], 90));
      await storage.put("turns", createMockTurn("s-3", 0, ["dsa"], 95));

      return storage;
    }

    it("renders summary statistics strip, level benchmark, strongest, and weakest focus areas", async () => {
      const storage = await setupManySessionsStorage();
      render(<SkillsDashboardScreen storage={storage} />);

      // Header & Takeaway
      expect(await screen.findByRole("heading", { name: "Skills Dashboard_" })).toBeTruthy();
      expect(screen.getByText(/Skill Calibration Chart/i)).toBeTruthy();

      // Target level benchmark (senior = 75%)
      expect(screen.getByText(/Benchmark: 75% target/i)).toBeTruthy();

      // Strongest skill (communication: 91%)
      expect(screen.getAllByText(/Structured Communication/i).length).toBeGreaterThan(0);

      // Weakest skill (system_design: 42%)
      const systemDesignElements = screen.getAllByText(/System Design & Architecture/i);
      expect(systemDesignElements.length).toBeGreaterThan(0);

      // Score bands
      expect(screen.getAllByText("Strong").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Needs work").length).toBeGreaterThan(0);

      // Stale skill badge (databases not practiced since Sept 20)
      expect(screen.getAllByText("Needs refresh").length).toBeGreaterThan(0);

      // Trend badge (+4.2%)
      expect(screen.getByText(/↗ \+4\.2%/i)).toBeTruthy();
    });

    it("filters skills by category when category tabs are clicked", async () => {
      const storage = await setupManySessionsStorage();
      render(<SkillsDashboardScreen storage={storage} />);

      await screen.findByRole("heading", { name: "Skills Dashboard_" });

      // Click "Behavioral Skills" tab
      const behavioralTab = screen.getByRole("tab", { name: /Behavioral Skills/i });
      fireEvent.click(behavioralTab);

      // Structured Communication should be in the filtered list
      expect(screen.getAllByText(/Structured Communication/i).length).toBeGreaterThan(0);

      // Data Structures & Algorithms should not be in the filtered chart list
      expect(screen.queryByRole("button", { name: "Data Structures & Algorithms" })).toBeNull();
    });

    it("toggles to accessible table view and displays full tabular data", async () => {
      const storage = await setupManySessionsStorage();
      render(<SkillsDashboardScreen storage={storage} />);

      await screen.findByRole("heading", { name: "Skills Dashboard_" });

      // Toggle to Table View
      const tableViewBtn = screen.getByRole("button", { name: /view as table/i });
      fireEvent.click(tableViewBtn);

      // Table elements
      const table = screen.getByRole("table");
      expect(table).toBeTruthy();

      expect(screen.getByRole("columnheader", { name: "Skill" })).toBeTruthy();
      expect(screen.getByRole("columnheader", { name: "Category" })).toBeTruthy();
      expect(screen.getByRole("columnheader", { name: "Score" })).toBeTruthy();
      expect(screen.getByRole("columnheader", { name: "Confidence" })).toBeTruthy();
      expect(screen.getByRole("columnheader", { name: "Status" })).toBeTruthy();

      // Row headers
      expect(screen.getByRole("rowheader", { name: /Data Structures & Algorithms/i })).toBeTruthy();

      // Toggle back to Chart View
      const chartViewBtn = screen.getByRole("button", { name: /chart view/i });
      fireEvent.click(chartViewBtn);
      expect(screen.getByText(/Skill Calibration Chart/i)).toBeTruthy();
    });

    it("opens score history drawer when a skill name button is clicked", async () => {
      const storage = await setupManySessionsStorage();
      render(<SkillsDashboardScreen storage={storage} />);

      await screen.findByRole("heading", { name: "Skills Dashboard_" });

      // Click on Data Structures & Algorithms name button to inspect history
      const dsaBtn = screen.getByRole("button", { name: "Data Structures & Algorithms" });
      fireEvent.click(dsaBtn);

      // Inspect drawer opens
      expect(
        await screen.findByRole("region", {
          name: /Detailed Trend History for Data Structures & Algorithms/i,
        })
      ).toBeTruthy();

      expect(
        screen.getByRole("heading", {
          name: /Data Structures & Algorithms — Score History & Trend/i,
        })
      ).toBeTruthy();

      // Close drawer
      const closeBtn = screen.getByRole("button", { name: /close trend details/i });
      fireEvent.click(closeBtn);

      expect(
        screen.queryByRole("region", {
          name: /Detailed Trend History for Data Structures & Algorithms/i,
        })
      ).toBeNull();
    });

    it("triggers onPracticeSkill callback when practice drill is clicked", async () => {
      const storage = await setupManySessionsStorage();
      const onPractice = vi.fn();
      render(<SkillsDashboardScreen storage={storage} onPracticeSkill={onPractice} />);

      await screen.findByRole("heading", { name: "Skills Dashboard_" });

      // Click "Practice Drill" for System Design
      const drillBtns = screen.getAllByRole("button", { name: /practice drill/i });
      fireEvent.click(drillBtns[0]!);

      expect(onPractice).toHaveBeenCalled();
    });
  });

  describe("Accessibility (axe)", () => {
    it("has zero axe violations under Ink theme", async () => {
      const storage = new MemoryStorageAdapter();
      const session = createMockSession("s-1", "2026-10-16T12:00:00Z");
      await storage.put("sessions", session);
      await storage.put("turns", createMockTurn("s-1", 0, ["dsa"], 80));

      const { container } = render(
        <div data-theme="ink">
          <SkillsDashboardScreen storage={storage} />
        </div>
      );

      await screen.findByRole("heading", { name: "Skills Dashboard_" });
      const results = await axe(container);
      expect(results.violations).toEqual([]);
    });

    it("has zero axe violations under Paper theme (table view)", async () => {
      const storage = new MemoryStorageAdapter();
      const session = createMockSession("s-1", "2026-10-16T12:00:00Z");
      await storage.put("sessions", session);
      await storage.put("turns", createMockTurn("s-1", 0, ["dsa"], 80));

      const { container } = render(
        <div data-theme="paper">
          <SkillsDashboardScreen storage={storage} />
        </div>
      );

      await screen.findByRole("heading", { name: "Skills Dashboard_" });

      // Switch to Table View
      const tableViewBtn = screen.getByRole("button", { name: /view as table/i });
      fireEvent.click(tableViewBtn);

      const results = await axe(container);
      expect(results.violations).toEqual([]);
    });
  });
});
