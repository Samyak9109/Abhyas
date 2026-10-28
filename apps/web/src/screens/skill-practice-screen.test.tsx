// FR-016, design.md 8 & 9 (PG-16): Tests for SkillPracticeScreen.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import {
  MemoryStorageAdapter,
  type Profile,
  type ProviderRow,
  type SessionPlan,
  type SkillStatRow,
} from "@abhyas/core";
import { SkillPracticeScreen } from "./SkillPracticeScreen";

describe("M2.4: SkillPracticeScreen (PG-16, FR-016)", () => {
  async function setupMockStorage(
    options: {
      hasProvider?: boolean;
      level?: Profile["level"];
      stats?: SkillStatRow[];
    } = {}
  ) {
    const storage = new MemoryStorageAdapter();

    // Provider setup
    if (options.hasProvider !== false) {
      const provider: ProviderRow = {
        id: "mock-prov-1",
        kind: "gemini",
        modelRoles: { interviewer: "gemini-2.0-flash", evaluator: "gemini-2.0-flash" },
      };
      await storage.put("providers", provider);
    }

    // Profile setup
    const profile: Profile = {
      id: "active-profile",
      level: options.level ?? "mid",
      targetRole: "Senior Systems Engineer",
      years: 5,
      updatedAt: "2026-10-17T10:00:00Z",
    };
    await storage.put("profile", profile);

    // Seeded skill stats (e.g. dsa weakest)
    if (options.stats) {
      for (const st of options.stats) {
        await storage.put("skillStats", st);
      }
    } else {
      const defaultStats: SkillStatRow[] = [
        {
          skillId: "dsa",
          score: 45,
          n: 4,
          confidence: "medium",
          lastPracticedAt: "2026-10-15T10:00:00Z",
          taxonomyVersion: 1,
        },
        {
          skillId: "communication",
          score: 85,
          n: 5,
          confidence: "medium",
          lastPracticedAt: "2026-10-15T10:00:00Z",
          taxonomyVersion: 1,
        },
      ];
      for (const st of defaultStats) {
        await storage.put("skillStats", st);
      }
    }

    return storage;
  }

  describe("Default Render & Settings", () => {
    it("renders page title, guidance note, format picker, and skill grid", async () => {
      const storage = await setupMockStorage();
      render(<SkillPracticeScreen storage={storage} onStartDrill={vi.fn()} />);

      // Header & Takeaway
      expect(await screen.findByRole("heading", { name: "Skill Practice_" })).toBeTruthy();
      expect(
        screen.getByText(/Targeted drills update only the selected skill's calibration statistics/i)
      ).toBeTruthy();

      // "Fix My Weakest" recommendation banner
      expect(
        screen.getByRole("heading", { name: /Fix My Weakest: Data Structures & Algorithms/i })
      ).toBeTruthy();

      // Drill Format options
      expect(screen.getByText(/⚡ Quick-Fire/i)).toBeTruthy();
      expect(screen.getByText(/🔍 Deep-Dive/i)).toBeTruthy();
      expect(screen.getByText(/5 questions · ~5–10 min/i)).toBeTruthy();
      expect(screen.getByText(/10 questions · ~15–20 min/i)).toBeTruthy();

      // Delivery Mode options
      expect(screen.getByText(/⌨️ Text Mode/i)).toBeTruthy();
      expect(screen.getByText(/🎙️ Voice Mode/i)).toBeTruthy();

      // Skills Category Tabs
      expect(screen.getByRole("tab", { name: /All Skills \(15\)/i })).toBeTruthy();
      expect(screen.getByRole("tab", { name: /Technical Skills/i })).toBeTruthy();
      expect(screen.getByRole("tab", { name: /Behavioral Skills/i })).toBeTruthy();
      expect(screen.getByRole("tab", { name: /Delivery Skills/i })).toBeTruthy();

      // Start Drill Button
      expect(screen.getByRole("button", { name: /Start Quick-Fire Drill/i })).toBeTruthy();
    });

    it("pre-selects initialSkillId if specified", async () => {
      const storage = await setupMockStorage();
      render(
        <SkillPracticeScreen
          storage={storage}
          initialSkillId="communication"
          onStartDrill={vi.fn()}
        />
      );

      expect(await screen.findByRole("heading", { name: "Skill Practice_" })).toBeTruthy();
      // Active skill pill should show Structured Communication
      expect(screen.getByText(/Active:/i)).toBeTruthy();
      expect(screen.getAllByText(/Structured Communication/i).length).toBeGreaterThan(0);
    });
  });

  describe("Interactions & Filtering", () => {
    it("filters skills when clicking category tabs", async () => {
      const storage = await setupMockStorage();
      render(<SkillPracticeScreen storage={storage} onStartDrill={vi.fn()} />);

      expect(await screen.findByRole("heading", { name: "Skill Practice_" })).toBeTruthy();

      // Click Behavioral Skills tab
      const behTab = screen.getByRole("tab", { name: /Behavioral Skills/i });
      fireEvent.click(behTab);

      // Behavioral skills visible in grid, technical skills filtered out
      const grid = document.querySelector(".abh-drill-skills-grid");
      expect(grid).toBeTruthy();
      expect(grid?.textContent).toContain("Structured Communication");
      expect(grid?.textContent).toContain("Ownership & Initiative");
      expect(grid?.textContent).not.toContain("Data Structures & Algorithms");
    });

    it("selects weakest skill when clicking 'Fix My Weakest' action", async () => {
      const storage = await setupMockStorage({
        stats: [
          {
            skillId: "system_design",
            score: 30,
            n: 4,
            confidence: "medium",
            lastPracticedAt: "2026-10-15T10:00:00Z",
            taxonomyVersion: 1,
          },
          {
            skillId: "dsa",
            score: 80,
            n: 6,
            confidence: "medium",
            lastPracticedAt: "2026-10-15T10:00:00Z",
            taxonomyVersion: 1,
          },
        ],
      });

      render(<SkillPracticeScreen storage={storage} onStartDrill={vi.fn()} />);

      // Weakest skill is system_design
      expect(await screen.findByText(/Fix My Weakest: System Design & Architecture/i)).toBeTruthy();

      const fixBtn = screen.getByRole("button", {
        name: /Focus Active|Select System Design & Architecture/i,
      });
      fireEvent.click(fixBtn);

      // Format switches to quick_fire
      const quickFireRadio = screen.getByRole("radio", { name: /Quick-Fire/i });
      expect(quickFireRadio.getAttribute("aria-checked")).toBe("true");
    });

    it("switches drill format between Quick-fire and Deep-dive", async () => {
      const storage = await setupMockStorage();
      render(<SkillPracticeScreen storage={storage} onStartDrill={vi.fn()} />);

      expect(await screen.findByRole("heading", { name: "Skill Practice_" })).toBeTruthy();

      const deepDiveBtn = screen.getByRole("radio", { name: /Deep-Dive/i });
      fireEvent.click(deepDiveBtn);

      expect(deepDiveBtn.getAttribute("aria-checked")).toBe("true");
      expect(screen.getByRole("button", { name: /Start Deep-Dive Drill/i })).toBeTruthy();
    });
  });

  describe("Missing Bank Questions Graceful Handling (FR-016 AC)", () => {
    it("displays warning callout and mixed session alternative when skill has 0 questions at current level", async () => {
      const storage = await setupMockStorage({ level: "intern_fresher" });
      const onStartSession = vi.fn();

      render(
        <SkillPracticeScreen
          storage={storage}
          onStartDrill={vi.fn()}
          onStartSession={onStartSession}
        />
      );

      expect(await screen.findByRole("heading", { name: "Skill Practice_" })).toBeTruthy();

      // Find a skill that has 0 bank questions at intern_fresher level, e.g. "leadership"
      const leadershipButton = screen.getByRole("radio", { name: /Leadership/i });
      fireEvent.click(leadershipButton);

      // Shows warning callout for missing questions
      expect(await screen.findByText(/No bank questions at/i)).toBeTruthy();
      expect(screen.getByText(/question bank currently has 0 questions for/i)).toBeTruthy();

      // Start Drill button should be disabled
      const startBtn = screen.getByRole("button", { name: /Start Quick-Fire Drill/i });
      expect(startBtn.getAttribute("disabled")).toBeDefined();

      // Click "Start Mixed Session Instead"
      const mixedSessionBtn = screen.getByRole("button", { name: /Start Mixed Session Instead/i });
      fireEvent.click(mixedSessionBtn);
      expect(onStartSession).toHaveBeenCalledTimes(1);
    });
  });

  describe("Starting Practice Drill", () => {
    it("calls onStartDrill with validated drill plan and selected questions", async () => {
      const storage = await setupMockStorage();
      const onStartDrill = vi.fn();

      render(<SkillPracticeScreen storage={storage} onStartDrill={onStartDrill} />);

      expect(await screen.findByRole("heading", { name: "Skill Practice_" })).toBeTruthy();

      // Select DSA
      const dsaBtn = screen.getByRole("radio", { name: /Data Structures & Algorithms/i });
      fireEvent.click(dsaBtn);

      // Click Start Drill
      const startBtn = screen.getByRole("button", { name: /Start Quick-Fire Drill/i });
      fireEvent.click(startBtn);

      await waitFor(() => {
        expect(onStartDrill).toHaveBeenCalledTimes(1);
      });

      const [passedPlan, passedQuestions] = onStartDrill.mock.calls[0] as [SessionPlan, unknown[]];

      expect(passedPlan.isDrill).toBe(true);
      expect(passedPlan.targetSkillId).toBe("dsa");
      expect(passedPlan.drillFormat).toBe("quick_fire");
      expect(passedPlan.length).toBe(5);
      expect(passedQuestions.length).toBeGreaterThan(0);
    });
  });

  describe("Accessibility (axe)", () => {
    it("has zero axe violations under Ink (dark) theme", async () => {
      const storage = await setupMockStorage();
      const { container } = render(
        <div data-theme="ink">
          <SkillPracticeScreen storage={storage} onStartDrill={vi.fn()} />
        </div>
      );

      expect(await screen.findByRole("heading", { name: "Skill Practice_" })).toBeTruthy();
      const results = await axe(container);
      expect(results.violations).toEqual([]);
    });

    it("has zero axe violations under Paper (light) theme", async () => {
      const storage = await setupMockStorage();
      const { container } = render(
        <div data-theme="paper">
          <SkillPracticeScreen storage={storage} onStartDrill={vi.fn()} />
        </div>
      );

      expect(await screen.findByRole("heading", { name: "Skill Practice_" })).toBeTruthy();
      const results = await axe(container);
      expect(results.violations).toEqual([]);
    });
  });
});
