// FR-018, design.md 8 (PG-14 full): Comprehensive tests for HomeScreen.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import {
  MemoryStorageAdapter,
  type SessionRow,
  type SkillStatRow,
  type TurnRow,
} from "@abhyas/core";
import { HomeScreen } from "./HomeScreen";

function createMockSession(
  id: string,
  startedAt: string,
  modality: "voice" | "text" = "voice",
  isDrill = false,
  skillId?: string
): {
  session: SessionRow;
  turns: TurnRow[];
} {
  const session: SessionRow = {
    id,
    startedAt,
    endedAt: new Date(new Date(startedAt).getTime() + 15 * 60 * 1000).toISOString(),
    status: "completed",
    plan: {
      sessionId: id,
      targetRole: "Backend Engineer",
      level: "mid",
      type: "technical",
      isDrill,
      targetSkillId: skillId,
    },
    modality,
    level: "mid",
    providerId: "openai-compatible",
    modelId: "gpt-4o-mini",
    schemaVersion: 1,
  };

  const turns: TurnRow[] = [
    {
      id: `${id}-turn-1`,
      sessionId: id,
      index: 0,
      questionId: "q-1",
      questionText: "How do you handle distributed transactions across services?",
      answerText:
        "I use the Saga pattern with compensating transactions and outbox event publishing.",
      isUnverifiedQuestion: false,
      skillTags: ["databases", "backend_apis"],
      difficulty: 0.6,
      status: "scored",
      evaluation: {
        criteria: {
          relevance: { score: 4, reason: "Direct", evidence: "Saga pattern" },
          structure: { score: 4, reason: "Clear", evidence: "Compensating transactions" },
          depth: { score: 4, reason: "Deep", evidence: "Outbox" },
          clarity: { score: 4, reason: "Articulate", evidence: "Clear terminology" },
          levelFit: { score: 4, reason: "Mid-level", evidence: "Realistic architecture" },
        },
        skillScores: { databases: 75, backend_apis: 75 },
        topFix: "Address idempotency on event consumers.",
        unsupportedClaims: [],
      },
    },
  ];

  return { session, turns };
}

describe("M2.6: HomeScreen (PG-14 full)", () => {
  it("renders first-time guided start state with mascot when no sessions exist", async () => {
    const storage = new MemoryStorageAdapter();
    const onStart = vi.fn();
    const onSettings = vi.fn();

    render(
      <HomeScreen
        storage={storage}
        onStartSession={onStart}
        onViewResults={vi.fn()}
        onNavigateSettings={onSettings}
      />
    );

    // Header & Mascot Welcome
    expect(await screen.findByRole("heading", { name: "Abhyas" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /welcome to your practice studio/i })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Abhyas pixel interviewer mascot" })).toBeTruthy();

    // 3 Guided Steps
    expect(screen.getByText("Step 1")).toBeTruthy();
    expect(screen.getByText("Step 2")).toBeTruthy();
    expect(screen.getByText("Step 3")).toBeTruthy();

    // Primary CTA
    const startBtn = screen.getByRole("button", { name: /start your first session/i });
    fireEvent.click(startBtn);
    expect(onStart).toHaveBeenCalledTimes(1);

    // Settings CTA
    const settingsBtn = screen.getByRole("button", { name: /configure keys in settings/i });
    fireEvent.click(settingsBtn);
    expect(onSettings).toHaveBeenCalledTimes(1);
  });

  it("renders returning user state with habit streak, daily drill card, and recent sessions", async () => {
    const storage = new MemoryStorageAdapter();
    const todayISO = new Date().toISOString();
    const { session, turns } = createMockSession("session-1", todayISO, "voice");

    await storage.put("sessions", session);
    for (const t of turns) {
      await storage.put("turns", t);
    }

    // Add calibrated skill stats with databases as weakest
    const stats: SkillStatRow[] = [
      {
        skillId: "system_design",
        score: 80,
        n: 6,
        confidence: "medium",
        lastPracticedAt: todayISO,
        taxonomyVersion: 1,
      },
      {
        skillId: "databases",
        score: 45,
        n: 4,
        confidence: "medium",
        lastPracticedAt: todayISO,
        taxonomyVersion: 1,
      },
    ];
    for (const s of stats) {
      await storage.put("skillStats", s);
    }

    const onViewResults = vi.fn();
    const onStartDailyDrill = vi.fn();
    const onNavigateHistory = vi.fn();

    render(
      <HomeScreen
        storage={storage}
        onStartSession={vi.fn()}
        onViewResults={onViewResults}
        onStartDailyDrill={onStartDailyDrill}
        onNavigateHistory={onNavigateHistory}
      />
    );

    expect(await screen.findByRole("heading", { name: "Abhyas" })).toBeTruthy();

    // Habit Streak & Goals
    expect(screen.getByText("Daily Habit")).toBeTruthy();
    expect(screen.getByText("Day streak")).toBeTruthy();
    expect(screen.getByText(/🛡️ 2 freezes left/)).toBeTruthy();
    expect(screen.getByText(/🛋️ Weekends off/)).toBeTruthy();
    expect(screen.getByText("Practiced today ✓")).toBeTruthy();
    expect(screen.getByText(/Weekly goal:/)).toBeTruthy();

    // Today's Daily Drill Card (Targeting calibrated weakest skill: databases)
    expect(screen.getByText(/Today's Daily Drill/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Databases & Storage" })).toBeTruthy();
    expect(screen.getByText(/Targets your calibrated weakest skill \(45% score\)/)).toBeTruthy();

    const drillBtn = screen.getByRole("button", { name: /start today's drill/i });
    fireEvent.click(drillBtn);
    expect(onStartDailyDrill).toHaveBeenCalledWith("databases");

    // Full Session Action Banner
    expect(screen.getByRole("heading", { name: /ready for a full interview\?/i })).toBeTruthy();

    // Recent Sessions Section
    expect(screen.getByRole("heading", { name: /recent practice sessions/i })).toBeTruthy();
    expect(screen.getByText("Backend Engineer")).toBeTruthy();
    expect(screen.getByText("Mid")).toBeTruthy();
    expect(screen.getByText("🎙 Voice")).toBeTruthy();
    expect(screen.getByText("75")).toBeTruthy(); // 4/5 converted -> 75%

    // View All in History
    const historyBtn = screen.getByRole("button", { name: /view all in history →/i });
    fireEvent.click(historyBtn);
    expect(onNavigateHistory).toHaveBeenCalledTimes(1);

    // Click View Results
    const viewBtn = screen.getByRole("button", { name: /view results/i });
    fireEvent.click(viewBtn);
    expect(onViewResults).toHaveBeenCalledWith("session-1");
  });

  it("displays completed badge when daily drill was already finished today", async () => {
    const storage = new MemoryStorageAdapter();
    const todayISO = new Date().toISOString();
    const { session } = createMockSession("drill-1", todayISO, "text", true, "databases");

    await storage.put("sessions", session);

    const onStartDailyDrill = vi.fn();

    render(
      <HomeScreen
        storage={storage}
        onStartSession={vi.fn()}
        onViewResults={vi.fn()}
        onStartDailyDrill={onStartDailyDrill}
      />
    );

    expect(await screen.findByRole("heading", { name: "Abhyas" })).toBeTruthy();
    expect(screen.getAllByText("Completed today ✓").length).toBeGreaterThan(0);

    const againBtn = screen.getByRole("button", { name: /practice again/i });
    fireEvent.click(againBtn);
    expect(onStartDailyDrill).toHaveBeenCalledWith("system_design");
  });

  describe("Accessibility (axe)", () => {
    it("has zero axe violations under Ink theme (First-time state)", async () => {
      const storage = new MemoryStorageAdapter();

      const { container } = render(
        <div data-theme="ink">
          <HomeScreen storage={storage} onStartSession={vi.fn()} onViewResults={vi.fn()} />
        </div>
      );

      await screen.findByRole("heading", { name: "Abhyas" });
      const results = await axe(container);
      expect(results.violations).toEqual([]);
    });

    it("has zero axe violations under Paper theme (Returning state)", async () => {
      const storage = new MemoryStorageAdapter();
      const todayISO = new Date().toISOString();
      const { session, turns } = createMockSession("session-1", todayISO, "text");

      await storage.put("sessions", session);
      for (const t of turns) {
        await storage.put("turns", t);
      }

      const { container } = render(
        <div data-theme="paper">
          <HomeScreen
            storage={storage}
            onStartSession={vi.fn()}
            onViewResults={vi.fn()}
            onStartDailyDrill={vi.fn()}
            onNavigateHistory={vi.fn()}
          />
        </div>
      );

      await screen.findByRole("heading", { name: "Abhyas" });
      const results = await axe(container);
      expect(results.violations).toEqual([]);
    });
  });
});
