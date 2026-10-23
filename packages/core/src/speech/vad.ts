// FR-009, FR-010, ADR-014: Core Voice Activity Detection (VAD) engine.
// Pure math and state machine for audio energy evaluation, speech onset detection,
// and trailing silence timeout for hands-free conversational turn-taking.

export interface VadOptions {
  /** RMS amplitude threshold above which audio is considered active speech (default: 0.02) */
  speechThreshold?: number | undefined;
  /** Number of consecutive active frames required to transition to 'speaking' (default: 2) */
  speechMinFrames?: number | undefined;
  /** Silence duration in milliseconds required after speech before triggering speech end (default: 1800ms) */
  silenceTimeoutMs?: number | undefined;
  /** Minimum speech duration in milliseconds before silence timeout can trigger completion (default: 400ms) */
  minSpeechDurationMs?: number | undefined;
  /** Callbacks for VAD state events */
  onSpeechStart?: (() => void) | undefined;
  onSpeechEnd?: (() => void) | undefined;
  onAudioLevel?: ((level: number, isSpeech: boolean) => void) | undefined;
  onSilenceCountdown?: ((remainingMs: number, totalMs: number) => void) | undefined;
}

export type VadState = "idle" | "listening" | "speaking" | "silence_waiting";

export interface VadFrameResult {
  rms: number;
  level: number; // 0.0 to 1.0 clamped
  isSpeech: boolean;
  state: VadState;
  remainingSilenceMs?: number | undefined;
}

/**
 * Calculates the Root Mean Square (RMS) energy of an audio sample buffer.
 */
export function calculateRms(samples: Float32Array | number[]): number {
  if (!samples || samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const val = samples[i] ?? 0;
    sum += val * val;
  }
  return Math.sqrt(sum / samples.length);
}

/**
 * Maps raw RMS amplitude to a normalized visual meter level between 0 and 1.
 */
export function rmsToMeterLevel(rms: number, sensitivityMultiplier = 5): number {
  if (rms <= 0.0001) return 0;
  const level = rms * sensitivityMultiplier;
  return Math.max(0, Math.min(1, level));
}

export class VadEngine {
  private readonly speechThreshold: number;
  private readonly speechMinFrames: number;
  private readonly silenceTimeoutMs: number;
  private readonly minSpeechDurationMs: number;

  private state: VadState = "idle";
  private consecutiveSpeechFrames = 0;
  private speechStartTime: number | null = null;
  private silenceStartTime: number | null = null;

  private readonly callbacks: Pick<
    VadOptions,
    "onSpeechStart" | "onSpeechEnd" | "onAudioLevel" | "onSilenceCountdown"
  >;

  constructor(options: VadOptions = {}) {
    this.speechThreshold = options.speechThreshold ?? 0.02;
    this.speechMinFrames = options.speechMinFrames ?? 2;
    this.silenceTimeoutMs = options.silenceTimeoutMs ?? 1800;
    this.minSpeechDurationMs = options.minSpeechDurationMs ?? 400;
    this.callbacks = {
      onSpeechStart: options.onSpeechStart,
      onSpeechEnd: options.onSpeechEnd,
      onAudioLevel: options.onAudioLevel,
      onSilenceCountdown: options.onSilenceCountdown,
    };
  }

  public getState(): VadState {
    return this.state;
  }

  public startListening(): void {
    this.reset();
    this.state = "listening";
  }

  public reset(): void {
    this.state = "idle";
    this.consecutiveSpeechFrames = 0;
    this.speechStartTime = null;
    this.silenceStartTime = null;
    this.callbacks.onSilenceCountdown?.(0, this.silenceTimeoutMs);
  }

  /**
   * Processes a frame of audio samples and updates internal speech/silence state.
   * @param samples Audio buffer chunk (e.g. 512, 1024, or 2048 float samples)
   * @param currentTimeMs Optional monotonic timestamp in milliseconds (defaults to Date.now())
   */
  public processFrame(
    samples: Float32Array | number[],
    currentTimeMs: number = Date.now()
  ): VadFrameResult {
    if (this.state === "idle") {
      return { rms: 0, level: 0, isSpeech: false, state: "idle" };
    }

    const rms = calculateRms(samples);
    const level = rmsToMeterLevel(rms);
    const isAboveThreshold = rms >= this.speechThreshold;

    this.callbacks.onAudioLevel?.(level, isAboveThreshold);

    if (isAboveThreshold) {
      this.consecutiveSpeechFrames++;
      this.silenceStartTime = null;
      this.callbacks.onSilenceCountdown?.(0, this.silenceTimeoutMs);

      if (this.state === "listening" && this.consecutiveSpeechFrames >= this.speechMinFrames) {
        this.state = "speaking";
        this.speechStartTime = currentTimeMs;
        this.callbacks.onSpeechStart?.();
      } else if (this.state === "silence_waiting") {
        // User resumed speaking before timeout expired
        this.state = "speaking";
      }
    } else {
      // Below threshold (silence/background noise)
      this.consecutiveSpeechFrames = 0;

      if (this.state === "speaking") {
        const speechDuration = currentTimeMs - (this.speechStartTime ?? currentTimeMs);
        if (speechDuration >= this.minSpeechDurationMs) {
          this.state = "silence_waiting";
          this.silenceStartTime = currentTimeMs;
        }
      }

      if (this.state === "silence_waiting" && this.silenceStartTime !== null) {
        const elapsedSilence = currentTimeMs - this.silenceStartTime;
        const remaining = Math.max(0, this.silenceTimeoutMs - elapsedSilence);

        this.callbacks.onSilenceCountdown?.(remaining, this.silenceTimeoutMs);

        if (remaining <= 0) {
          this.state = "idle";
          this.callbacks.onSpeechEnd?.();
          return { rms, level, isSpeech: false, state: "idle", remainingSilenceMs: 0 };
        }

        return {
          rms,
          level,
          isSpeech: false,
          state: "silence_waiting",
          remainingSilenceMs: remaining,
        };
      }
    }

    return {
      rms,
      level,
      isSpeech: isAboveThreshold,
      state: this.state,
    };
  }
}
