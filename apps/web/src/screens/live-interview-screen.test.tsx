// FR-008, FR-011, PG-12: Tests for LiveInterviewScreen (Text-only MVP).
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import {
  MemoryStorageAdapter,
  MockProviderAdapter,
  MockSpeechInput,
  MockSpeechOutput,
  type SelectedQuestion,
  type SessionPlan,
  type SpeechInputStartCallbacks,
} from "@abhyas/core";
import { LiveInterviewScreen } from "./LiveInterviewScreen";
import * as speechModule from "../services/speech";

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

const sampleVoicePlan: SessionPlan = {
  ...samplePlan,
  inputMode: "voice",
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

    await waitFor(() => {
      expect(screen.getByText("40 / 2000 characters")).toBeTruthy();
    });
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

  describe("M1.6: Voice Mode & Subtitles (FR-009, FR-010, PG-12)", () => {
    it("renders push-to-talk button, subtitle lanes, and speaks initial question", async () => {
      const storage = new MemoryStorageAdapter();
      const mockSpeechInput = new MockSpeechInput({
        isSupported: true,
        transcript: "Spoken answer",
      });
      const mockSpeechOutput = new MockSpeechOutput({ isSupported: true });

      render(
        <LiveInterviewScreen
          storage={storage}
          plan={sampleVoicePlan}
          questions={sampleQuestions}
          speechInput={mockSpeechInput}
          speechOutput={mockSpeechOutput}
          onFinish={vi.fn()}
          onExit={vi.fn()}
        />
      );

      // Question rendered
      expect(
        await screen.findByRole("heading", {
          name: "When a web page experiences poor INP, how do you diagnose the bottleneck?",
        })
      ).toBeTruthy();

      // Interviewer question spoken aloud via speech output
      await waitFor(() => {
        expect(mockSpeechOutput.getSpokenTexts()).toContain(
          "When a web page experiences poor INP, how do you diagnose the bottleneck?"
        );
      });

      // Push-To-Talk button present
      expect(screen.getByRole("button", { name: "Start speaking answer" })).toBeTruthy();
      expect(screen.getByText("Push to Talk")).toBeTruthy();

      // Subtitle lanes present with interviewer and candidate labels
      expect(screen.getByText("{ AI }")).toBeTruthy();
      expect(screen.getByText("{ You }")).toBeTruthy();
    });

    it("executes PTT listening, interim speech, stop, review step and submission", async () => {
      const storage = new MemoryStorageAdapter();
      const mockSpeechInput = new MockSpeechInput({
        isSupported: true,
        transcript: "Draft answer from speech",
      });
      const mockSpeechOutput = new MockSpeechOutput({ isSupported: true });

      render(
        <LiveInterviewScreen
          storage={storage}
          plan={sampleVoicePlan}
          questions={sampleQuestions}
          speechInput={mockSpeechInput}
          speechOutput={mockSpeechOutput}
          onFinish={vi.fn()}
          onExit={vi.fn()}
        />
      );

      await screen.findByRole("heading", {
        name: "When a web page experiences poor INP, how do you diagnose the bottleneck?",
      });

      // 1. Click Push-to-Talk to start listening
      const pttBtn = screen.getByRole("button", { name: "Start speaking answer" });
      fireEvent.click(pttBtn);

      await waitFor(() => {
        expect(mockSpeechInput.getState()).toBe("listening");
        expect(
          screen.getByRole("button", { name: "Stop speaking and review answer" })
        ).toBeTruthy();
      });

      // 2. Emit interim text
      mockSpeechInput.emitInterim("Diagnosing long tasks using Profiler");
      expect(await screen.findByText(/Diagnosing long tasks using Profiler/i)).toBeTruthy();

      // 3. Stop speaking
      const stopBtn = screen.getByRole("button", { name: "Stop speaking and review answer" });
      fireEvent.click(stopBtn);

      // 4. Review step appears with editable textarea (FR-009)
      const reviewTextarea = (await screen.findByLabelText(
        "Review Your Answer Before Submitting"
      )) as HTMLTextAreaElement;
      expect(reviewTextarea).toBeTruthy();
      expect(reviewTextarea.value).toBe("Draft answer from speech");

      // 5. Candidate edits the transcript before submission
      fireEvent.change(reviewTextarea, {
        target: { value: "Draft answer from speech and checking scheduler.yield()." },
      });
      expect(reviewTextarea.value).toBe("Draft answer from speech and checking scheduler.yield().");

      // 6. Submit answer
      const submitBtn = screen.getByRole("button", { name: "Submit Answer" });
      fireEvent.click(submitBtn);

      // Successfully advances to turn history / next question
      await waitFor(() => {
        expect(screen.getByText("Session History (1)")).toBeTruthy();
        expect(
          screen.getByText("Draft answer from speech and checking scheduler.yield().")
        ).toBeTruthy();
      });
    });

    it("switches to typing mode and back to voice mode", async () => {
      const storage = new MemoryStorageAdapter();
      const mockSpeechInput = new MockSpeechInput({ isSupported: true });
      const mockSpeechOutput = new MockSpeechOutput({ isSupported: true });

      render(
        <LiveInterviewScreen
          storage={storage}
          plan={sampleVoicePlan}
          questions={sampleQuestions}
          speechInput={mockSpeechInput}
          speechOutput={mockSpeechOutput}
          onFinish={vi.fn()}
          onExit={vi.fn()}
        />
      );

      await screen.findByRole("heading", {
        name: "When a web page experiences poor INP, how do you diagnose the bottleneck?",
      });

      // Click "Prefer typing? Switch to text mode"
      const switchToTextBtn = screen.getByRole("button", {
        name: "Prefer typing? Switch to text mode",
      });
      fireEvent.click(switchToTextBtn);

      // Text answer textarea is now visible
      expect(await screen.findByLabelText("Your Answer")).toBeTruthy();

      // Click "Want to speak? Switch to voice mode"
      const switchToVoiceBtn = screen.getByRole("button", {
        name: "Want to speak? Switch to voice mode",
      });
      fireEvent.click(switchToVoiceBtn);

      // Voice PTT is back
      expect(await screen.findByRole("button", { name: "Start speaking answer" })).toBeTruthy();
    });

    it("handles microphone permission denied error with switch to typing option", async () => {
      const storage = new MemoryStorageAdapter();
      const mockSpeechInput = new MockSpeechInput({ isSupported: true });
      const mockSpeechOutput = new MockSpeechOutput({ isSupported: true });

      render(
        <LiveInterviewScreen
          storage={storage}
          plan={sampleVoicePlan}
          questions={sampleQuestions}
          speechInput={mockSpeechInput}
          speechOutput={mockSpeechOutput}
          onFinish={vi.fn()}
          onExit={vi.fn()}
        />
      );

      await screen.findByRole("heading", {
        name: "When a web page experiences poor INP, how do you diagnose the bottleneck?",
      });

      // Start listening
      const pttBtn = screen.getByRole("button", { name: "Start speaking answer" });
      fireEvent.click(pttBtn);

      await waitFor(() => {
        expect(mockSpeechInput.getState()).toBe("listening");
      });

      // Simulate permission denied error
      mockSpeechInput.emitError({
        kind: "not_allowed",
        message: "Permission denied by user.",
        retryable: false,
      });

      // Error callout appears
      expect(await screen.findByText("Microphone Access Blocked")).toBeTruthy();
      expect(screen.getByText(/Permission denied by user/i)).toBeTruthy();

      // Click "Switch to Typing" button in callout
      const switchToTypingBtn = screen.getByRole("button", { name: "Switch to Typing" });
      fireEvent.click(switchToTypingBtn);

      // Now in text mode
      expect(await screen.findByLabelText("Your Answer")).toBeTruthy();
    });

    it("mutes and cancels interviewer speech when Mute button is clicked", async () => {
      const storage = new MemoryStorageAdapter();
      const mockSpeechInput = new MockSpeechInput({ isSupported: true });
      const mockSpeechOutput = new MockSpeechOutput({ isSupported: true });

      render(
        <LiveInterviewScreen
          storage={storage}
          plan={sampleVoicePlan}
          questions={sampleQuestions}
          speechInput={mockSpeechInput}
          speechOutput={mockSpeechOutput}
          onFinish={vi.fn()}
          onExit={vi.fn()}
        />
      );

      await screen.findByRole("heading", {
        name: "When a web page experiences poor INP, how do you diagnose the bottleneck?",
      });

      const muteBtn = screen.getByRole("button", { name: /Mute/i });
      fireEvent.click(muteBtn);

      expect(mockSpeechOutput.isSpeaking()).toBe(false);
      expect(screen.getByRole("button", { name: /Unmute/i })).toBeTruthy();
    });
  });

  describe("Accessibility (axe)", () => {
    it("has zero axe violations under Ink theme (Text Mode)", async () => {
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

    it("has zero axe violations under Paper theme (Text Mode)", async () => {
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

    it("has zero axe violations under Ink theme (Voice Mode)", async () => {
      const storage = new MemoryStorageAdapter();
      const mockSpeechInput = new MockSpeechInput({ isSupported: true });
      const mockSpeechOutput = new MockSpeechOutput({ isSupported: true });

      const { container } = render(
        <div data-theme="ink">
          <LiveInterviewScreen
            storage={storage}
            plan={sampleVoicePlan}
            questions={sampleQuestions}
            speechInput={mockSpeechInput}
            speechOutput={mockSpeechOutput}
            onFinish={vi.fn()}
            onExit={vi.fn()}
          />
        </div>
      );

      await screen.findByRole("heading", {
        name: "When a web page experiences poor INP, how do you diagnose the bottleneck?",
      });

      const results = await axe(container);
      expect(results.violations).toEqual([]);
    });

    it("has zero axe violations under Paper theme (Voice Mode)", async () => {
      const storage = new MemoryStorageAdapter();
      const mockSpeechInput = new MockSpeechInput({ isSupported: true });
      const mockSpeechOutput = new MockSpeechOutput({ isSupported: true });

      const { container } = render(
        <div data-theme="paper">
          <LiveInterviewScreen
            storage={storage}
            plan={sampleVoicePlan}
            questions={sampleQuestions}
            speechInput={mockSpeechInput}
            speechOutput={mockSpeechOutput}
            onFinish={vi.fn()}
            onExit={vi.fn()}
          />
        </div>
      );

      await screen.findByRole("heading", {
        name: "When a web page experiences poor INP, how do you diagnose the bottleneck?",
      });

      const results = await axe(container);
      expect(results.violations).toEqual([]);
    });
  });

  describe("Device Rules Enforcement (M3.5, FR-022, ADR-013)", () => {
    it("enforces text-only mode and NEVER constructs speech services in local mode on PC", async () => {
      const speechInputSpy = vi.spyOn(speechModule, "getBrowserSpeechInput");
      const speechOutputSpy = vi.spyOn(speechModule, "getBrowserSpeechOutput");

      const storage = new MemoryStorageAdapter();
      const localPlan: SessionPlan = {
        ...sampleVoicePlan, // Even if requested inputMode was voice!
        isLocalModel: true,
      };

      const mockLocalProvider = new MockProviderAdapter({ id: "webllm" });

      render(
        <LiveInterviewScreen
          storage={storage}
          plan={localPlan}
          questions={sampleQuestions}
          provider={mockLocalProvider}
          onFinish={vi.fn()}
          onExit={vi.fn()}
        />
      );

      // Verify text interface is rendered
      await screen.findByRole("heading", {
        name: "When a web page experiences poor INP, how do you diagnose the bottleneck?",
      });

      expect(screen.getByRole("textbox", { name: /your answer/i })).toBeDefined();

      // Voice controls should NOT be rendered
      expect(screen.queryByRole("button", { name: /push to speak/i })).toBeNull();
      expect(screen.queryByText(/Want to speak\? Switch to voice mode/i)).toBeNull();

      // Crucial: speech services were NEVER constructed
      expect(speechInputSpy).not.toHaveBeenCalled();
      expect(speechOutputSpy).not.toHaveBeenCalled();

      speechInputSpy.mockRestore();
      speechOutputSpy.mockRestore();
    });

    it("has zero axe violations under Ink theme in Local Text Mode", async () => {
      const storage = new MemoryStorageAdapter();
      const localPlan: SessionPlan = {
        ...samplePlan,
        isLocalModel: true,
      };

      const mockLocalProvider = new MockProviderAdapter({ id: "webllm" });

      const { container } = render(
        <div data-theme="ink">
          <LiveInterviewScreen
            storage={storage}
            plan={localPlan}
            questions={sampleQuestions}
            provider={mockLocalProvider}
            onFinish={vi.fn()}
            onExit={vi.fn()}
          />
        </div>
      );

      await screen.findByRole("heading", {
        name: "When a web page experiences poor INP, how do you diagnose the bottleneck?",
      });

      expect((await axe(container)).violations).toEqual([]);
    });

    it("has zero axe violations under Paper theme in Local Text Mode", async () => {
      const storage = new MemoryStorageAdapter();
      const localPlan: SessionPlan = {
        ...samplePlan,
        isLocalModel: true,
      };

      const mockLocalProvider = new MockProviderAdapter({ id: "webllm" });

      const { container } = render(
        <div data-theme="paper">
          <LiveInterviewScreen
            storage={storage}
            plan={localPlan}
            questions={sampleQuestions}
            provider={mockLocalProvider}
            onFinish={vi.fn()}
            onExit={vi.fn()}
          />
        </div>
      );

      await screen.findByRole("heading", {
        name: "When a web page experiences poor INP, how do you diagnose the bottleneck?",
      });

      expect((await axe(container)).violations).toEqual([]);
    });
  });

  describe("M7.3: Hands-Free Voice Activity Detection (VAD, ADR-014)", () => {
    it("renders hands-free badge, start hands-free button, audio level meter and countdown", async () => {
      const storage = new MemoryStorageAdapter();
      await storage.put("settings", {
        key: "voice",
        value: {
          enabled: true,
          autoPlay: false,
          rate: 1.0,
          vadEnabled: true,
          silenceTimeoutMs: 1800,
          speechEngine: "on-device",
        },
      });

      let registeredCallbacks: SpeechInputStartCallbacks | undefined;

      const customMockInput = {
        isSupported: true,
        getState: () => "idle" as const,
        start: vi.fn(async (cb?: SpeechInputStartCallbacks) => {
          registeredCallbacks = cb;
          cb?.onStateChange?.("listening");
        }),
        stop: vi.fn(async () => "Hands-free voice answer"),
        abort: vi.fn(),
      };

      const { container } = render(
        <div data-theme="ink">
          <LiveInterviewScreen
            storage={storage}
            plan={sampleVoicePlan}
            questions={sampleQuestions}
            speechInput={customMockInput}
            onFinish={vi.fn()}
            onExit={vi.fn()}
          />
        </div>
      );

      await screen.findByRole("heading", {
        name: "When a web page experiences poor INP, how do you diagnose the bottleneck?",
      });

      await waitFor(() => {
        expect(screen.getByText("Hands-Free Auto-Submit")).toBeTruthy();
        expect(screen.getByText("Private On-Device")).toBeTruthy();
        expect(
          screen.getByRole("button", {
            name: /Start speaking \(hands-free auto-submit on pause\)/i,
          })
        ).toBeTruthy();
      });

      // Start hands-free listening
      const startBtn = screen.getByRole("button", {
        name: /Start speaking \(hands-free auto-submit on pause\)/i,
      });
      fireEvent.click(startBtn);

      await waitFor(() => {
        expect(screen.getByRole("meter", { name: "Microphone input level" })).toBeTruthy();
      });

      // Trigger audio level and silence countdown
      registeredCallbacks?.onAudioLevel?.(0.6, true);
      registeredCallbacks?.onSilenceCountdown?.(1200, 1800);

      await waitFor(() => {
        expect(screen.getByText(/Auto-submitting in 1.2s/i)).toBeTruthy();
      });

      // Zero axe violations while in hands-free listening state
      expect((await axe(container)).violations).toEqual([]);

      // Stop listening (auto-commit or manual button click)
      const stopBtn = screen.getByRole("button", { name: "Stop speaking and review answer" });
      fireEvent.click(stopBtn);

      await waitFor(() => {
        expect(screen.getByText("Review Your Answer Before Submitting")).toBeTruthy();
        expect(screen.getByDisplayValue("Hands-free voice answer")).toBeTruthy();
      });
    });
  });
});
