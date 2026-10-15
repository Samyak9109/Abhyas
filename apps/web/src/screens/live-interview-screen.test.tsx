// FR-008, FR-011, PG-12: Tests for LiveInterviewScreen (Text-only MVP).
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryStorageAdapter, type SelectedQuestion, type SessionPlan } from "@abhyas/core";
import { LiveInterviewScreen } from "./LiveInterviewScreen";

const samplePlan: SessionPlan = {
  sessionId: "test-live-session-1",
  type: "technical",
  length: 5,
  style: "standard",
  inputMode: "text",
  level: "mid",
  targetRole: "Full Stack Engineer",
  createdAt: new Date().toISOString(),
};

const sampleQuestions: SelectedQuestion[] = [
  {
    id: "q-1",
    bankId: "q-tech-fe-001",
    text: "When a web page experiences poor INP, how do you diagnose the bottleneck?",
    difficulty: 0.4,
    skillTags: ["frontend", "clarity"],
    rubricHints: ["Long tasks scheduler.yield()", "Forced synchronous layout"],
    isUnverified: false,
  },
  {
    id: "q-2",
    bankId: "q-tech-be-001",
    text: "How do you design a payment processing API endpoint to guarantee strict idempotency?",
    difficulty: 0.6,
    skillTags: ["backend_apis"],
    rubricHints: ["Unique idempotency keys", "Atomic write"],
    isUnverified: false,
  },
];

describe("M1.5: LiveInterviewScreen (PG-12)", () => {
  it("renders the initial question, top bar progress, timer, controls, and textarea", async () => {
    const storage = new MemoryStorageAdapter();
    const onFinish = vi.fn();
    const onExit = vi.fn();

    render(
      <LiveInterviewScreen
        storage={storage}
        plan={samplePlan}
        questions={sampleQuestions}
        onFinish={onFinish}
        onExit={onExit}
      />
    );

    // Initial question is loaded asynchronously by SessionRunner
    expect(
      await screen.findByText(
        "When a web page experiences poor INP, how do you diagnose the bottleneck?"
      )
    ).toBeTruthy();

    // Top Bar
    expect(screen.getByText("Abhyas")).toBeTruthy();
    expect(screen.getByText("Question 1 of 5")).toBeTruthy();
    expect(screen.getByText("00:00")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Pause/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^End$/i })).toBeTruthy();

    // Interviewer Card
    expect(screen.getByText("{ standard interviewer }")).toBeTruthy();
    expect(screen.getByText("frontend")).toBeTruthy();
    expect(screen.getByText("clarity")).toBeTruthy();

    // Answer Field & Controls
    const textarea = screen.getByLabelText("Your Answer");
    expect(textarea).toBeTruthy();
    expect(screen.getByText("0 / 2000 characters")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Hint/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Repeat/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Skip/i })).toBeTruthy();
    const submitBtn = screen.getByRole("button", { name: /Submit Answer/i }) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
  });

  it("updates character counter as user types and enables Submit button", async () => {
    const storage = new MemoryStorageAdapter();

    render(
      <LiveInterviewScreen
        storage={storage}
        plan={samplePlan}
        questions={sampleQuestions}
        onFinish={vi.fn()}
        onExit={vi.fn()}
      />
    );

    await screen.findByText(
      "When a web page experiences poor INP, how do you diagnose the bottleneck?"
    );

    const textarea = screen.getByLabelText("Your Answer");
    fireEvent.change(textarea, { target: { value: "I use Chrome DevTools Performance panel." } });

    expect(screen.getByText("40 / 2000 characters")).toBeTruthy();
    const submitBtn = screen.getByRole("button", { name: /Submit Answer/i }) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(false);
  });

  it("submits answer, records turn, and advances to the next question", async () => {
    const storage = new MemoryStorageAdapter();

    render(
      <LiveInterviewScreen
        storage={storage}
        plan={samplePlan}
        questions={sampleQuestions}
        onFinish={vi.fn()}
        onExit={vi.fn()}
      />
    );

    await screen.findByText(
      "When a web page experiences poor INP, how do you diagnose the bottleneck?"
    );

    const textarea = screen.getByLabelText("Your Answer");
    fireEvent.change(textarea, {
      target: { value: "I profile JavaScript execution and break up long tasks." },
    });

    const submitBtn = screen.getByRole("button", { name: /Submit Answer/i });
    fireEvent.click(submitBtn);

    // Transitions to evaluate, then automatically advances to next question or follow-up
    expect(
      await screen.findByText(
        "How do you design a payment processing API endpoint to guarantee strict idempotency?"
      )
    ).toBeTruthy();

    // Verify turn history is displayed
    expect(screen.getByText(/Session History/i)).toBeTruthy();
    expect(
      screen.getAllByText("I profile JavaScript execution and break up long tasks.").length
    ).toBeGreaterThanOrEqual(1);
  });

  it("handles Skip button to skip current question", async () => {
    const storage = new MemoryStorageAdapter();

    render(
      <LiveInterviewScreen
        storage={storage}
        plan={samplePlan}
        questions={sampleQuestions}
        onFinish={vi.fn()}
        onExit={vi.fn()}
      />
    );

    await screen.findByText(
      "When a web page experiences poor INP, how do you diagnose the bottleneck?"
    );

    const skipBtn = screen.getByRole("button", { name: /Skip/i });
    fireEvent.click(skipBtn);

    expect(
      await screen.findByText(
        "How do you design a payment processing API endpoint to guarantee strict idempotency?"
      )
    ).toBeTruthy();
  });

  it("handles Hint button to request a hint", async () => {
    const storage = new MemoryStorageAdapter();

    render(
      <LiveInterviewScreen
        storage={storage}
        plan={samplePlan}
        questions={sampleQuestions}
        onFinish={vi.fn()}
        onExit={vi.fn()}
      />
    );

    await screen.findByText(
      "When a web page experiences poor INP, how do you diagnose the bottleneck?"
    );

    const hintBtn = screen.getByRole("button", { name: /Hint/i });
    fireEvent.click(hintBtn);

    expect(await screen.findByText(/Interviewer Hint/i)).toBeTruthy();
    expect(screen.getByText(/Long tasks scheduler.yield()/i)).toBeTruthy();
  });

  it("pauses and resumes interview session", async () => {
    const storage = new MemoryStorageAdapter();

    render(
      <LiveInterviewScreen
        storage={storage}
        plan={samplePlan}
        questions={sampleQuestions}
        onFinish={vi.fn()}
        onExit={vi.fn()}
      />
    );

    await screen.findByText(
      "When a web page experiences poor INP, how do you diagnose the bottleneck?"
    );

    const pauseBtn = screen.getByRole("button", { name: /Pause/i });
    fireEvent.click(pauseBtn);

    expect(await screen.findByText("Session Paused")).toBeTruthy();

    // In paused state, resume button is available in the banner and top bar
    const resumeBtn = screen.getByRole("button", { name: "Resume Interview" });
    fireEvent.click(resumeBtn);

    await waitFor(() => {
      expect(screen.queryByText("Session Paused")).toBeNull();
    });
  });

  it("shows confirmation dialog when End button is clicked and exits on confirmation", async () => {
    const storage = new MemoryStorageAdapter();
    const onExit = vi.fn();

    render(
      <LiveInterviewScreen
        storage={storage}
        plan={samplePlan}
        questions={sampleQuestions}
        onFinish={vi.fn()}
        onExit={onExit}
      />
    );

    await screen.findByText(
      "When a web page experiences poor INP, how do you diagnose the bottleneck?"
    );

    const endBtn = screen.getByRole("button", { name: /^End$/i });
    fireEvent.click(endBtn);

    expect(screen.getByText("End interview early?")).toBeTruthy();

    const confirmEndBtn = screen.getByRole("button", { name: "End Interview" });
    fireEvent.click(confirmEndBtn);

    await waitFor(() => {
      expect(onExit).toHaveBeenCalledTimes(1);
    });
  });

  describe("Accessibility (axe)", () => {
    it("has zero axe violations under Ink theme", async () => {
      const storage = new MemoryStorageAdapter();
      const { container } = render(
        <div data-theme="ink">
          <LiveInterviewScreen
            storage={storage}
            plan={samplePlan}
            questions={sampleQuestions}
            onFinish={vi.fn()}
            onExit={vi.fn()}
          />
        </div>
      );

      await screen.findByText(
        "When a web page experiences poor INP, how do you diagnose the bottleneck?"
      );

      const results = await axe(container);
      expect(results.violations).toEqual([]);
    });

    it("has zero axe violations under Paper theme", async () => {
      const storage = new MemoryStorageAdapter();
      const { container } = render(
        <div data-theme="paper">
          <LiveInterviewScreen
            storage={storage}
            plan={samplePlan}
            questions={sampleQuestions}
            onFinish={vi.fn()}
            onExit={vi.fn()}
          />
        </div>
      );

      await screen.findByText(
        "When a web page experiences poor INP, how do you diagnose the bottleneck?"
      );

      const results = await axe(container);
      expect(results.violations).toEqual([]);
    });
  });
});
