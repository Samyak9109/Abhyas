// FR-028, PG-23: Tests for ReviewQueueScreen.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryStorageAdapter, type ReviewQueueRow, type TurnRow } from "@abhyas/core";
import { ReviewQueueScreen } from "./ReviewQueueScreen";

function createMockTurn(
  id: string,
  score: number,
  questionText = "How do you handle db indexing?"
): TurnRow {
  const critScore = Math.max(1, Math.min(5, Math.round((score / 100) * 4 + 1)));
  return {
    id,
    sessionId: "sess-1",
    index: 0,
    questionId: `q-${id}`,
    isUnverifiedQuestion: false,
    skillTags: ["database_design"],
    difficulty: 0.6,
    questionText,
    answerText: "Indexes speed up read operations but slow writes.",
    status: "scored",
    evaluation: {
      criteria: {
        relevance: { score: critScore, reason: "Relevance note", evidence: "..." },
        structure: { score: critScore, reason: "Structure note", evidence: "..." },
        depth: { score: critScore, reason: "Depth note", evidence: "..." },
        clarity: { score: critScore, reason: "Clarity note", evidence: "..." },
        levelFit: { score: critScore, reason: "Level fit note", evidence: "..." },
      },
      skillScores: { database_design: score },
      topFix: "Discuss B-Tree vs Hash index trade-offs",
      unsupportedClaims: [],
    },
  };
}

describe("PG-23: ReviewQueueScreen (M6.2)", () => {
  it("renders empty state when queue has zero items", async () => {
    const storage = new MemoryStorageAdapter();
    render(<ReviewQueueScreen storage={storage} />);

    await waitFor(() => {
      expect(screen.getByText("Review Queue & Spaced Repetition")).toBeTruthy();
    });

    expect(screen.getByText(/All Caught Up!/i)).toBeTruthy();
    expect(screen.getByText(/You have zero questions due for review today/i)).toBeTruthy();
    expect(screen.getAllByText("0").length).toBe(2); // 0 Due today and 0 Total in Queue
  });

  it("renders due questions with past scores, top fix, and interval badges", async () => {
    const storage = new MemoryStorageAdapter();

    const turn = createMockTurn("turn-1", 45, "Explain database indexing in depth.");
    await storage.put("turns", turn);

    const dueItem: ReviewQueueRow = {
      id: "review-turn-1",
      turnId: "turn-1",
      intervalDays: 1,
      dueAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago (due today)
    };
    await storage.put("reviewQueue", dueItem);

    render(<ReviewQueueScreen storage={storage} onStartReviewDrill={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText("Explain database indexing in depth.")).toBeTruthy();
    });

    expect(screen.getByText(/Past Score: 50\/100/i)).toBeTruthy();
    expect(screen.getByText("Interval: 1d")).toBeTruthy();
    expect(screen.getByText(/Discuss B-Tree vs Hash index trade-offs/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Start Daily Review Drill/i })).toBeTruthy();
  });

  it("enforces daily cap of 10 items even if more items are overdue", async () => {
    const storage = new MemoryStorageAdapter();

    // Insert 15 overdue turns and queue items
    for (let i = 1; i <= 15; i++) {
      const turn = createMockTurn(`turn-${i}`, 40, `Question ${i}`);
      await storage.put("turns", turn);

      const queueItem: ReviewQueueRow = {
        id: `review-turn-${i}`,
        turnId: `turn-${i}`,
        intervalDays: 1,
        dueAt: new Date(Date.now() - (20 - i) * 3600000).toISOString(),
      };
      await storage.put("reviewQueue", queueItem);
    }

    render(<ReviewQueueScreen storage={storage} onStartReviewDrill={() => {}} />);

    await waitFor(() => {
      // Due Today counter shows 10 (capped), while Total in Queue shows 15
      expect(screen.getByText("10")).toBeTruthy();
      expect(screen.getByText("15")).toBeTruthy();
    });

    expect(screen.getByRole("button", { name: /Start Daily Review Drill \(10\)/i })).toBeTruthy();
  });

  it("dismisses an item from review queue when Dismiss is clicked", async () => {
    const storage = new MemoryStorageAdapter();

    const turn = createMockTurn("turn-del", 40, "Question to be dismissed");
    await storage.put("turns", turn);
    await storage.put("reviewQueue", {
      id: "review-turn-del",
      turnId: "turn-del",
      intervalDays: 1,
      dueAt: new Date(Date.now() - 3600000).toISOString(),
    });

    render(<ReviewQueueScreen storage={storage} />);

    await waitFor(() => {
      expect(screen.getByText("Question to be dismissed")).toBeTruthy();
    });

    const dismissBtn = screen.getByRole("button", { name: /Remove question from review queue/i });
    fireEvent.click(dismissBtn);

    await waitFor(() => {
      expect(screen.queryByText("Question to be dismissed")).toBeNull();
      expect(screen.getByText(/All Caught Up!/i)).toBeTruthy();
    });

    const remaining = await storage.getAll<ReviewQueueRow>("reviewQueue");
    expect(remaining.length).toBe(0);
  });

  it("launches daily review drill when button is clicked", async () => {
    const storage = new MemoryStorageAdapter();
    const startDrillMock = vi.fn();

    const turn = createMockTurn("turn-drill", 50, "Question for drill");
    await storage.put("turns", turn);
    await storage.put("reviewQueue", {
      id: "review-turn-drill",
      turnId: "turn-drill",
      intervalDays: 1,
      dueAt: new Date(Date.now() - 3600000).toISOString(),
    });

    render(<ReviewQueueScreen storage={storage} onStartReviewDrill={startDrillMock} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Start Daily Review Drill/i })).toBeTruthy();
    });

    const startBtn = screen.getByRole("button", { name: /Start Daily Review Drill/i });
    fireEvent.click(startBtn);

    expect(startDrillMock).toHaveBeenCalledTimes(1);
    const [plan, questions] = startDrillMock.mock.calls[0] as [unknown, unknown[]];
    expect((plan as { isDrill: boolean }).isDrill).toBe(true);
    expect(questions.length).toBe(1);
    expect((questions[0] as { text: string }).text).toBe("Question for drill");
  });

  it("has zero accessibility violations with vitest-axe", async () => {
    const storage = new MemoryStorageAdapter();
    const { container } = render(
      <div data-theme="ink">
        <ReviewQueueScreen storage={storage} />
      </div>
    );

    await waitFor(() => {
      expect(screen.getByText("Review Queue & Spaced Repetition")).toBeTruthy();
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
