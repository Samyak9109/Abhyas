// FR-018, design.md 8 (PG-14): Tests for HomeScreen.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryStorageAdapter, type SessionRow, type TurnRow } from "@abhyas/core";
import { HomeScreen } from "./HomeScreen";

function createMockSession(
  id: string,
  startedAt: string,
  modality: "voice" | "text" = "voice"
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

describe("M1.7: HomeScreen (PG-14 minimal)", () => {
  it("renders first-time guided start state when no sessions exist", async () => {
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

  it("renders returning user state with recent sessions list", async () => {
    const storage = new MemoryStorageAdapter();
    const { session, turns } = createMockSession("session-1", "2026-10-16T12:00:00Z", "voice");

    await storage.put("sessions", session);
    for (const t of turns) {
      await storage.put("turns", t);
    }

    const onViewResults = vi.fn();

    render(<HomeScreen storage={storage} onStartSession={vi.fn()} onViewResults={onViewResults} />);

    expect(await screen.findByRole("heading", { name: "Abhyas" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /ready for your next session\?/i })).toBeTruthy();

    // Recent Sessions Section
    expect(screen.getByRole("heading", { name: /recent practice sessions/i })).toBeTruthy();
    expect(screen.getByText("Backend Engineer")).toBeTruthy();
    expect(screen.getByText("Mid")).toBeTruthy();
    expect(screen.getByText("🎙 Voice")).toBeTruthy();

    // Score chip
    expect(screen.getByText("75")).toBeTruthy(); // 4/5 converted -> ((4-1)/4)*100 = 75%

    // Click View Results
    const viewBtn = screen.getByRole("button", { name: /view results/i });
    fireEvent.click(viewBtn);

    expect(onViewResults).toHaveBeenCalledWith("session-1");
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
      const { session, turns } = createMockSession("session-1", "2026-10-16T12:00:00Z", "text");

      await storage.put("sessions", session);
      for (const t of turns) {
        await storage.put("turns", t);
      }

      const { container } = render(
        <div data-theme="paper">
          <HomeScreen storage={storage} onStartSession={vi.fn()} onViewResults={vi.fn()} />
        </div>
      );

      await screen.findByRole("heading", { name: "Abhyas" });
      const results = await axe(container);
      expect(results.violations).toEqual([]);
    });
  });
});
