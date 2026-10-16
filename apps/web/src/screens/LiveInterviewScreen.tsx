// FR-008, FR-009, FR-010, FR-011, PG-12: Live interview screen (Voice + Text modes).
// Focus view with progress, timer, interviewer card, subtitle lanes,
// push-to-talk talk timer, review step, turn history, and error recovery options.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_SUBTITLE_SETTINGS,
  DEFAULT_VOICE_SETTINGS,
  loadSubtitleSettings,
  loadVoiceSettings,
  SessionRunner,
  type InterviewState,
  type ProviderAdapter,
  type SelectedQuestion,
  type SessionPlan,
  type SpeechInput,
  type SpeechOutput,
  type StorageAdapter,
  type SubtitleSettings,
  type VoiceSettings,
} from "@abhyas/core";
import { Button, Callout, Dialog, Progress, SubtitleLanes } from "../components";
import { getBrowserSpeechInput, getBrowserSpeechOutput } from "../services/speech";

interface LiveInterviewScreenProps {
  storage: StorageAdapter;
  plan: SessionPlan;
  questions: SelectedQuestion[];
  provider?: ProviderAdapter;
  speechInput?: SpeechInput;
  speechOutput?: SpeechOutput;
  onFinish: () => void;
  onExit: () => void;
}

const MAX_ANSWER_CHARS = 2000;

export function LiveInterviewScreen({
  storage,
  plan,
  questions,
  provider,
  speechInput,
  speechOutput,
  onFinish,
  onExit,
}: LiveInterviewScreenProps) {
  // Speech services
  const inputService = useMemo(() => speechInput ?? getBrowserSpeechInput(), [speechInput]);
  const outputService = useMemo(() => speechOutput ?? getBrowserSpeechOutput(), [speechOutput]);

  // Mode resolution (fallback to text if voice is not supported)
  const [effectiveMode, setEffectiveMode] = useState<"text" | "voice">(() => {
    return plan.inputMode === "voice" && inputService.isSupported ? "voice" : "text";
  });

  // Settings
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const [subtitleSettings, setSubtitleSettings] =
    useState<SubtitleSettings>(DEFAULT_SUBTITLE_SETTINGS);
  const [isMuted, setIsMuted] = useState(false);
  const [subtitlesCollapsed, setSubtitlesCollapsed] = useState(false);

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
  const reviewTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Voice state
  const [pttState, setPttState] = useState<"idle" | "listening" | "reviewing">("idle");
  const [interimSpeech, setInterimSpeech] = useState("");
  const [pttSeconds, setPttSeconds] = useState(0);
  const [speechError, setSpeechError] = useState<{ message: string; isPermission: boolean } | null>(
    null
  );

  // Load voice & subtitle settings from storage on mount
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [loadedVoice, loadedSubtitles] = await Promise.all([
          loadVoiceSettings(storage),
          loadSubtitleSettings(storage),
        ]);
        if (active) {
          setVoiceSettings(loadedVoice);
          setSubtitleSettings(loadedSubtitles);
          if (!loadedVoice.enabled) {
            setIsMuted(true);
          }
        }
      } catch {
        // Fallback to defaults
      }
    })();
    return () => {
      active = false;
    };
  }, [storage]);

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

  // PTT Talk elapsed timer
  useEffect(() => {
    if (pttState !== "listening") return;
    const timer = setInterval(() => {
      setPttSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [pttState]);

  // Clean-up speech on unmount
  useEffect(() => {
    return () => {
      outputService.cancel();
      void inputService.abort();
    };
  }, [outputService, inputService]);

  // Clear answer and reset voice state when moving to a new question
  useEffect(() => {
    if (state.status === "await_answer") {
      setTypedAnswer("");
      setInterimSpeech("");
      setPttState("idle");
      setSpeechError(null);
      if (effectiveMode === "text") {
        textareaRef.current?.focus();
      }
    }
  }, [state.status, state.context.currentQuestion?.id, effectiveMode]);

  // Auto-speak question in voice mode (FR-010)
  const lastSpokenRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      effectiveMode === "voice" &&
      state.status === "await_answer" &&
      state.context.currentQuestion &&
      !isMuted &&
      voiceSettings.enabled &&
      voiceSettings.autoPlay
    ) {
      const q = state.context.currentQuestion;
      const key = `${state.context.currentQuestionIndex}-${q.id}`;
      if (lastSpokenRef.current !== key) {
        lastSpokenRef.current = key;
        void outputService.speak(q.text, {
          rate: voiceSettings.rate,
          voiceURI: voiceSettings.voiceURI,
        });
      }
    }
  }, [
    effectiveMode,
    state.status,
    state.context.currentQuestion,
    state.context.currentQuestionIndex,
    isMuted,
    voiceSettings,
    outputService,
  ]);

  // Handle question repeat animation
  useEffect(() => {
    if (state.context.repeatRequested) {
      setHighlightQuestion(true);
      const timer = setTimeout(() => setHighlightQuestion(false), 1200);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [state.context.repeatRequested]);

  // Focus review textarea when entering reviewing step
  useEffect(() => {
    if (pttState === "reviewing") {
      reviewTextareaRef.current?.focus();
    }
  }, [pttState]);

  // --- Voice Actions (FR-009) ---

  const startListening = async () => {
    if (state.status !== "await_answer" || pttState === "listening") return;
    // Interrupt ongoing interviewer speech immediately (design.md 7.1)
    outputService.cancel();
    setSpeechError(null);
    setInterimSpeech("");
    setPttSeconds(0);

    try {
      await inputService.start({
        onInterim: (text) => setInterimSpeech(text),
        onFinal: (text) => {
          setTypedAnswer((prev) => (prev ? `${prev} ${text}` : text).trim());
        },
        onError: (err) => {
          setPttState("idle");
          setSpeechError({
            message: err.message,
            isPermission: err.kind === "not_allowed",
          });
        },
        onStateChange: (s) => {
          if (s === "listening") setPttState("listening");
        },
      });
      setPttState("listening");
    } catch (err) {
      setPttState("idle");
      setSpeechError({
        message: err instanceof Error ? err.message : "Failed to start speech recognition",
        isPermission: true,
      });
    }
  };

  const stopListening = async () => {
    if (pttState !== "listening") return;
    try {
      const finalTranscript = await inputService.stop();
      const combined = (finalTranscript || interimSpeech || typedAnswer).trim();
      setTypedAnswer(combined);
      setInterimSpeech("");
      setPttState("reviewing");
    } catch {
      setPttState("idle");
    }
  };

  const handlePttToggle = async () => {
    if (pttState === "listening") {
      await stopListening();
    } else if (pttState === "idle") {
      await startListening();
    }
  };

  const handleRecordAgain = async () => {
    setTypedAnswer("");
    setInterimSpeech("");
    setPttState("idle");
    await startListening();
  };

  const handleSwitchToTyping = () => {
    if (pttState === "listening") {
      void inputService.abort();
    }
    outputService.cancel();
    setPttState("idle");
    setEffectiveMode("text");
  };

  const handleSwitchToVoice = () => {
    if (inputService.isSupported) {
      setEffectiveMode("voice");
      setPttState("idle");
      setSpeechError(null);
    }
  };

  const handlersRef = useRef({
    startListening,
    stopListening,
    handleSubmit,
  });
  useEffect(() => {
    handlersRef.current = {
      startListening,
      stopListening,
      handleSubmit,
    };
  });

  // Keyboard shortcuts (FR-011, Space for PTT, Ctrl+Enter to submit)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      // Spacebar for Push-to-Talk (only in voice mode, only when NOT typing in an input/textarea)
      if (
        e.code === "Space" &&
        !isInput &&
        effectiveMode === "voice" &&
        state.status === "await_answer"
      ) {
        e.preventDefault();
        if (pttState === "idle") {
          void handlersRef.current.startListening();
        } else if (pttState === "listening") {
          void handlersRef.current.stopListening();
        }
      }

      // Ctrl+Enter or Cmd+Enter to submit
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && state.status === "await_answer") {
        if (typedAnswer.trim()) {
          e.preventDefault();
          void handlersRef.current.handleSubmit();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [effectiveMode, pttState, state.status, typedAnswer]);

  // --- Actions ---

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!typedAnswer.trim() || state.status !== "await_answer") return;

    outputService.cancel();
    const answerToSubmit = typedAnswer.trim().slice(0, MAX_ANSWER_CHARS);
    setTypedAnswer("");
    setInterimSpeech("");
    setPttState("idle");
    await runner.dispatch({
      type: "SUBMIT",
      answerText: answerToSubmit,
    });
  };

  const handleSkip = async () => {
    if (state.status !== "await_answer") return;
    outputService.cancel();
    if (pttState === "listening") {
      void inputService.abort();
      setPttState("idle");
    }
    await runner.dispatch({ type: "SKIP" });
  };

  const handleHint = async () => {
    if (state.status !== "await_answer") return;
    await runner.dispatch({ type: "HINT" });
  };

  const handleRepeat = async () => {
    if (state.status !== "await_answer") return;
    if (effectiveMode === "voice" && !isMuted && state.context.currentQuestion) {
      outputService.cancel();
      void outputService.speak(state.context.currentQuestion.text, {
        rate: voiceSettings.rate,
        voiceURI: voiceSettings.voiceURI,
      });
    }
    await runner.dispatch({ type: "REPEAT" });
  };

  const handleTogglePause = async () => {
    if (state.status === "paused") {
      await runner.dispatch({ type: "RESUME" });
    } else {
      outputService.cancel();
      if (pttState === "listening") {
        void inputService.abort();
        setPttState("idle");
      }
      await runner.dispatch({ type: "PAUSE" });
    }
  };

  const handleConfirmEnd = async () => {
    outputService.cancel();
    if (pttState === "listening") {
      void inputService.abort();
      setPttState("idle");
    }
    setShowEndDialog(false);
    await runner.dispatch({ type: "END" });
    onExit();
  };

  const handleRetry = async () => {
    await runner.dispatch({ type: "RETRY" });
  };

  const handleSavePartial = async () => {
    outputService.cancel();
    if (pttState === "listening") {
      void inputService.abort();
    }
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
            {effectiveMode === "voice" && (
              <Button
                variant="ghost"
                onClick={() => {
                  if (!isMuted) {
                    outputService.cancel();
                  }
                  setIsMuted((prev) => !prev);
                }}
                aria-label={isMuted ? "Unmute interviewer voice" : "Mute interviewer voice"}
              >
                {isMuted ? "Unmute" : "Mute"}
              </Button>
            )}
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

        {/* Fallback Notice when plan requested voice but browser does not support it */}
        {plan.inputMode === "voice" && !inputService.isSupported && (
          <Callout variant="info" title="Voice Input Unavailable">
            Voice recognition is not supported in this browser. Switched to typing mode
            automatically.
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
                {state.status === "await_answer" &&
                  (pttState === "listening"
                    ? "Listening to you..."
                    : pttState === "reviewing"
                      ? "Review your response..."
                      : "Waiting for your answer...")}
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

        {/* Live Subtitle Lanes (FR-010, design.md 7.2) */}
        {effectiveMode === "voice" && subtitleSettings.enabled && (
          <SubtitleLanes
            interviewerText={currentQ?.text || ""}
            candidateText={
              pttState === "listening"
                ? interimSpeech || "Listening..."
                : pttState === "reviewing"
                  ? typedAnswer
                  : ""
            }
            isCandidateInterim={pttState === "listening"}
            size={subtitleSettings.size}
            highContrast={subtitleSettings.highContrast}
            visible={!subtitlesCollapsed}
            onToggleVisible={() => setSubtitlesCollapsed((prev) => !prev)}
          />
        )}

        {/* Live Hint Callout */}
        {state.context.hintText && (
          <Callout variant="info" title="Interviewer Hint">
            {state.context.hintText}
          </Callout>
        )}

        {/* Microphone Permission / Speech Input Error (design.md 7.1) */}
        {speechError && (
          <Callout
            variant="danger"
            title={speechError.isPermission ? "Microphone Access Blocked" : "Speech Input Issue"}
          >
            <p>{speechError.message || "Microphone access was denied or is unavailable."}</p>
            {speechError.isPermission && (
              <p className="abh-form-hint" style={{ marginTop: "var(--space-2)" }}>
                To enable voice, click the lock or camera icon in your address bar, allow
                Microphone, and click Try Again.
              </p>
            )}
            <div style={{ marginTop: "var(--space-3)", display: "flex", gap: "var(--space-2)" }}>
              <Button variant="secondary" onClick={() => setSpeechError(null)}>
                Try Again
              </Button>
              <Button variant="primary" onClick={handleSwitchToTyping}>
                Switch to Typing
              </Button>
            </div>
          </Callout>
        )}

        {/* === VOICE MODE INTERACTION (FR-009, design.md 7.1) === */}
        {effectiveMode === "voice" && state.status !== "paused" && (
          <section className="abh-voice-section" aria-label="Voice answer control">
            {/* Review step: editable transcript before submitting (FR-009) */}
            {pttState === "reviewing" ? (
              <div className="abh-voice-review-box">
                <div className="abh-voice-review-header">
                  <label htmlFor="voice-review-textarea" className="abh-form-label">
                    Review Your Answer Before Submitting
                  </label>
                  <span className="abh-form-hint">
                    {typedAnswer.length} / {MAX_ANSWER_CHARS} characters
                  </span>
                </div>
                <textarea
                  ref={reviewTextareaRef}
                  id="voice-review-textarea"
                  className="abh-textarea"
                  rows={5}
                  value={typedAnswer}
                  onChange={(e) => setTypedAnswer(e.target.value.slice(0, MAX_ANSWER_CHARS))}
                  placeholder="Your spoken transcript will appear here. Edit or fix any words before submitting."
                  disabled={state.status === "evaluate"}
                  aria-describedby="review-help-text"
                />
                <span id="review-help-text" className="abh-form-hint">
                  Fix any transcription errors above. You can submit when ready or record again.
                </span>

                <div className="abh-voice-review-actions">
                  <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void handleRecordAgain()}
                      disabled={state.status !== "await_answer"}
                    >
                      Record Again
                    </Button>
                    <button
                      type="button"
                      className="abh-switch-to-text-btn"
                      onClick={handleSwitchToTyping}
                    >
                      Switch to typing
                    </button>
                  </div>

                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => void handleSubmit()}
                    disabled={!typedAnswer.trim() || state.status !== "await_answer"}
                    isLoading={state.status === "evaluate"}
                  >
                    {state.status === "evaluate" ? "Evaluating..." : "Submit Answer"}
                  </Button>
                </div>
              </div>
            ) : (
              /* Push-To-Talk Button */
              <div className="abh-ptt-container">
                <button
                  type="button"
                  className={`abh-ptt-button ${
                    pttState === "listening" ? "abh-ptt-button--listening" : ""
                  }`}
                  onClick={() => void handlePttToggle()}
                  disabled={state.status !== "await_answer"}
                  aria-label={
                    pttState === "listening"
                      ? "Stop speaking and review answer"
                      : "Start speaking answer"
                  }
                >
                  <div className="abh-ptt-label">
                    <span className="abh-ptt-icon" aria-hidden="true">
                      {pttState === "listening" ? "⏹" : "🎙"}
                    </span>
                    <span>{pttState === "listening" ? "Stop & Review" : "Push to Talk"}</span>
                    {pttState === "listening" && (
                      <span className="abh-ptt-elapsed">{formatTime(pttSeconds)}</span>
                    )}
                  </div>
                </button>
                <span className="abh-ptt-shortcut-hint">
                  Tap button or press Space to {pttState === "listening" ? "stop" : "talk"}
                </span>
                <button
                  type="button"
                  className="abh-switch-to-text-btn"
                  onClick={handleSwitchToTyping}
                >
                  Prefer typing? Switch to text mode
                </button>
              </div>
            )}

            {/* Voice Secondary Controls */}
            <div className="abh-interview-controls-row" style={{ marginTop: "var(--space-3)" }}>
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
            </div>
          </section>
        )}

        {/* === TEXT ANSWER AREA (FR-011) === */}
        {effectiveMode === "text" && state.status !== "paused" && (
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
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "var(--space-2)",
                }}
              >
                <span id="answer-help-text" className="abh-form-hint">
                  Press Submit or use Ctrl+Enter when complete. You can also ask for a hint or skip.
                </span>
                {inputService.isSupported && (
                  <button
                    type="button"
                    className="abh-switch-to-text-btn"
                    onClick={handleSwitchToVoice}
                  >
                    Want to speak? Switch to voice mode
                  </button>
                )}
              </div>
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
