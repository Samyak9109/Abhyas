// FR-008, FR-011, PG-12: Live interview screen (Text-only MVP).
// Focus view with progress, timer, interviewer card, hint callouts,
// turn history, answer textarea, and error recovery options.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  SessionRunner,
  type InterviewState,
  type ProviderAdapter,
  type SelectedQuestion,
  type SessionPlan,
  type StorageAdapter,
} from "@abhyas/core";
import { Button, Callout, Dialog, Progress } from "../components";

interface LiveInterviewScreenProps {
  storage: StorageAdapter;
  plan: SessionPlan;
  questions: SelectedQuestion[];
  provider?: ProviderAdapter;
  onFinish: () => void;
  onExit: () => void;
}

const MAX_ANSWER_CHARS = 2000;

export function LiveInterviewScreen({
  storage,
  plan,
  questions,
  provider,
  onFinish,
  onExit,
}: LiveInterviewScreenProps) {
  // Initialize the SessionRunner once per plan
  const runner = useMemo(() => {
    return new SessionRunner({
      plan,
      questions,
      storage,
      provider,
      autoStart: true,
    });
  }, [plan, questions, storage, provider]);

  const [state, setState] = useState<InterviewState>(() => runner.getState());
  const [typedAnswer, setTypedAnswer] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [highlightQuestion, setHighlightQuestion] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Subscribe to runner state updates
  useEffect(() => {
    const unsubscribe = runner.subscribe((nextState) => {
      setState(nextState);
    });
    return () => {
      unsubscribe();
    };
  }, [runner]);

  // Session elapsed timer (ticks when not paused and not terminal)
  useEffect(() => {
    if (state.status === "paused" || state.status === "results" || state.status === "ended") {
      return;
    }
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [state.status]);

  // Clear answer field when moving to a new question
  useEffect(() => {
    if (state.status === "await_answer") {
      setTypedAnswer("");
      textareaRef.current?.focus();
    }
  }, [state.status, state.context.currentQuestion?.id]);

  // Handle question repeat animation
  useEffect(() => {
    if (state.context.repeatRequested) {
      setHighlightQuestion(true);
      const timer = setTimeout(() => setHighlightQuestion(false), 1200);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [state.context.repeatRequested]);

  // --- Actions ---

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!typedAnswer.trim() || state.status !== "await_answer") return;

    const answerToSubmit = typedAnswer.trim().slice(0, MAX_ANSWER_CHARS);
    setTypedAnswer("");
    await runner.dispatch({
      type: "SUBMIT",
      answerText: answerToSubmit,
    });
  };

  const handleSkip = async () => {
    if (state.status !== "await_answer") return;
    await runner.dispatch({ type: "SKIP" });
  };

  const handleHint = async () => {
    if (state.status !== "await_answer") return;
    await runner.dispatch({ type: "HINT" });
  };

  const handleRepeat = async () => {
    if (state.status !== "await_answer") return;
    await runner.dispatch({ type: "REPEAT" });
  };

  const handleTogglePause = async () => {
    if (state.status === "paused") {
      await runner.dispatch({ type: "RESUME" });
    } else {
      await runner.dispatch({ type: "PAUSE" });
    }
  };

  const handleConfirmEnd = async () => {
    setShowEndDialog(false);
    await runner.dispatch({ type: "END" });
    onExit();
  };

  const handleRetry = async () => {
    await runner.dispatch({ type: "RETRY" });
  };

  const handleSavePartial = async () => {
    await runner.dispatch({ type: "SAVE_PARTIAL" });
    onExit();
  };

  // Format mm:ss
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${rem.toString().padStart(2, "0")}`;
  };

  const totalQuestions = plan.length;
  const currentNum = Math.min(state.context.currentQuestionIndex + 1, totalQuestions);
  const progressPercent = (currentNum / totalQuestions) * 100;
  const currentQ = state.context.currentQuestion;

  // --- Terminal Views ---

  if (state.status === "results") {
    return (
      <div className="abh-interview-page abh-interview-results-view">
        <main className="abh-interview-main">
          <div className="abh-results-card">
            <span className="abh-step-badge">&#123; Session Complete &#125;</span>
            <h1 className="abh-setup-title">
              Interview Completed
              <span className="abh-cursor-motif" aria-hidden="true">
                _
              </span>
            </h1>
            <p className="abh-setup-intro">
              Great practice session! All answers have been saved locally to your device.
            </p>

            <div className="abh-results-summary-stats">
              <div className="abh-stat-tile">
                <span className="abh-stat-label">Target Role</span>
                <span className="abh-stat-val">{plan.targetRole}</span>
              </div>
              <div className="abh-stat-tile">
                <span className="abh-stat-label">Experience Level</span>
                <span className="abh-stat-val">{plan.level.replace("_", " ")}</span>
              </div>
              <div className="abh-stat-tile">
                <span className="abh-stat-label">Questions Completed</span>
                <span className="abh-stat-val">
                  {state.context.turns.length} of {totalQuestions}
                </span>
              </div>
              <div className="abh-stat-tile">
                <span className="abh-stat-label">Elapsed Time</span>
                <span className="abh-stat-val">{formatTime(elapsedSeconds)}</span>
              </div>
            </div>

            <div className="abh-setup-actions">
              <Button variant="primary" onClick={onFinish}>
                Finish Session
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="abh-interview-page">
      {/* Top Bar Navigation */}
      <header className="abh-interview-topbar">
        <div className="abh-interview-topbar-inner">
          <div className="abh-topbar-left">
            <span className="abh-wordmark">Abhyas</span>
            <span
              className="abh-topbar-badge"
              aria-label={`Question ${currentNum} of ${totalQuestions}`}
            >
              Question {currentNum} of {totalQuestions}
            </span>
          </div>

          <div className="abh-topbar-center">
            <span
              className="abh-timer-text"
              aria-label={`Elapsed time ${formatTime(elapsedSeconds)}`}
            >
              {formatTime(elapsedSeconds)}
            </span>
          </div>

          <div className="abh-topbar-right">
            <Button
              variant="ghost"
              onClick={handleTogglePause}
              disabled={state.status === "evaluate" || state.status === "error_recoverable"}
              aria-label={state.status === "paused" ? "Resume interview" : "Pause interview"}
            >
              {state.status === "paused" ? "Resume" : "Pause"}
            </Button>
            <Button variant="ghost" onClick={() => setShowEndDialog(true)}>
              End
            </Button>
          </div>
        </div>

        {/* Progress track */}
        <div className="abh-interview-progress-track">
          <Progress label="Session progress" value={progressPercent} />
        </div>
      </header>

      {/* Main Focus Area */}
      <main className="abh-interview-main">
        {/* Paused Banner */}
        {state.status === "paused" && (
          <Callout variant="warning" title="Session Paused">
            The interview timer is paused. Take your time, then click Resume when you are ready.
            <div style={{ marginTop: "var(--space-2)" }}>
              <Button variant="primary" onClick={handleTogglePause}>
                Resume Interview
              </Button>
            </div>
          </Callout>
        )}

        {/* Recoverable Error Callout */}
        {state.status === "error_recoverable" && (
          <Callout variant="danger" title="Provider Issue">
            {state.context.recoverableError?.message || "An AI service error occurred."}
            <div className="abh-error-actions-row">
              <Button variant="primary" onClick={handleRetry}>
                Retry Action
              </Button>
              <Button variant="secondary" onClick={handleSavePartial}>
                Save Partial & Exit
              </Button>
              <Button variant="ghost" onClick={() => setShowEndDialog(true)}>
                End Session
              </Button>
            </div>
          </Callout>
        )}

        {/* Center: Interviewer Card */}
        <div className={`abh-interviewer-card ${highlightQuestion ? "highlight" : ""}`}>
          <div className="abh-interviewer-header">
            <div className="abh-interviewer-mascot-head" aria-hidden="true">
              AI
            </div>
            <div className="abh-interviewer-meta">
              <span className="abh-interviewer-style-tag">
                &#123; {plan.style} interviewer &#125;
              </span>
              <span className="abh-interviewer-status-text" role="status" aria-live="polite">
                {state.status === "ask" && "Asking question..."}
                {state.status === "await_answer" && "Waiting for your answer..."}
                {state.status === "evaluate" && "Evaluating your response..."}
                {state.status === "wrap_up" && "Wrapping up interview..."}
                {state.status === "paused" && "Paused"}
              </span>
            </div>
          </div>

          <div className="abh-question-content">
            {currentQ?.followUpCount && currentQ.followUpCount > 0 ? (
              <span className="abh-followup-badge">Follow-up {currentQ.followUpCount} of 2</span>
            ) : null}
            <h2 className="abh-question-text">{currentQ?.text || "Preparing next question..."}</h2>
          </div>

          {currentQ?.skillTags && currentQ.skillTags.length > 0 && (
            <div className="abh-question-tags-row">
              {currentQ.skillTags.map((tag) => (
                <span key={tag} className="abh-skill-pill">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Live Hint Callout */}
        {state.context.hintText && (
          <Callout variant="info" title="Interviewer Hint">
            {state.context.hintText}
          </Callout>
        )}

        {/* Text Answer Area */}
        {state.status !== "paused" && (
          <form onSubmit={handleSubmit} className="abh-answer-form">
            <div className="abh-form-field">
              <div className="abh-field-header-row">
                <label htmlFor="interview-answer-textarea" className="abh-form-label">
                  Your Answer
                </label>
                <span className="abh-form-hint">
                  {typedAnswer.length} / {MAX_ANSWER_CHARS} characters
                </span>
              </div>
              <textarea
                ref={textareaRef}
                id="interview-answer-textarea"
                className="abh-textarea"
                rows={6}
                value={typedAnswer}
                onChange={(e) => setTypedAnswer(e.target.value.slice(0, MAX_ANSWER_CHARS))}
                placeholder="Type your structured answer here (e.g. context, approach, trade-offs, outcome)..."
                disabled={state.status === "evaluate" || state.status === "error_recoverable"}
                aria-describedby="answer-help-text"
              />
              <span id="answer-help-text" className="abh-form-hint">
                Press Submit or use Ctrl+Enter when complete. You can also ask for a hint or skip.
              </span>
            </div>

            {/* Answer Control Buttons */}
            <div className="abh-interview-controls-row">
              <div className="abh-secondary-controls">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleHint}
                  disabled={state.status !== "await_answer" || Boolean(state.context.hintText)}
                >
                  Hint
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleRepeat}
                  disabled={state.status !== "await_answer"}
                >
                  Repeat
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleSkip}
                  disabled={state.status !== "await_answer"}
                >
                  Skip
                </Button>
              </div>

              <Button
                type="submit"
                variant="primary"
                onClick={() => void handleSubmit()}
                disabled={!typedAnswer.trim() || state.status !== "await_answer"}
                isLoading={state.status === "evaluate"}
              >
                {state.status === "evaluate" ? "Evaluating..." : "Submit Answer"}
              </Button>
            </div>
          </form>
        )}

        {/* Turn History Thread */}
        {state.context.turns.length > 0 && (
          <section className="abh-thread-section" aria-labelledby="history-heading">
            <h3 id="history-heading" className="abh-section-heading">
              Session History ({state.context.turns.length})
            </h3>
            <div className="abh-thread-list">
              {state.context.turns.map((t, idx) => (
                <div key={t.id || idx} className="abh-thread-turn">
                  <div className="abh-thread-q">
                    <strong>Q: {t.questionText}</strong>
                  </div>
                  <div className="abh-thread-a">
                    <p>{t.answerText}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Confirmation End Dialog */}
      <Dialog
        isOpen={showEndDialog}
        onClose={() => setShowEndDialog(false)}
        title="End interview early?"
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowEndDialog(false)}>
              Keep Practicing
            </Button>
            <Button variant="danger" onClick={handleConfirmEnd}>
              End Interview
            </Button>
          </>
        }
      >
        <p>
          Your completed turns will be safely saved to your browser storage. You can review partial
          results or start a new session anytime.
        </p>
      </Dialog>
    </div>
  );
}
