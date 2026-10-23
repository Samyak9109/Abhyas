// FR-009, FR-010, FR-021, ADR-014: Hands-free Voice Activity Detection (VAD) speech input service.
// Wraps a SpeechInput instance with Web Audio API energy monitoring and trailing silence auto-submit.

import {
  VadEngine,
  type SpeechInput,
  type SpeechInputStartCallbacks,
  type SpeechInputState,
  type VadOptions,
} from "@abhyas/core";
import { BrowserSpeechInput } from "./browser-speech-input.js";

export interface HandsFreeOptions extends VadOptions {
  /** Underlying speech recognition provider (defaults to BrowserSpeechInput) */
  innerInput?: SpeechInput | undefined;
  /** AudioContext factory or instance for tests */
  audioContext?: AudioContext | undefined;
  /** getUserMedia function for tests */
  getUserMedia?: ((constraints: MediaStreamConstraints) => Promise<MediaStream>) | undefined;
}

export class HandsFreeSpeechInput implements SpeechInput {
  public readonly isSupported: boolean;
  private readonly inner: SpeechInput;
  private readonly vad: VadEngine;

  private state: SpeechInputState = "idle";
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private analyser: AnalyserNode | null = null;
  private animationFrameId: number | null = null;
  private userCallbacks?: SpeechInputStartCallbacks | undefined;

  private readonly customAudioContext?: AudioContext | undefined;
  private readonly customGetUserMedia?:
    | ((constraints: MediaStreamConstraints) => Promise<MediaStream>)
    | undefined;

  constructor(options: HandsFreeOptions = {}) {
    this.inner = options.innerInput ?? new BrowserSpeechInput();
    this.customAudioContext = options.audioContext;
    this.customGetUserMedia = options.getUserMedia;

    // Supported if inner recognition is supported or audio context/stream is available
    const hasAudio =
      typeof window !== "undefined" &&
      (Boolean(
        window.AudioContext ||
          (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext
      ) ||
        Boolean(options.audioContext));
    this.isSupported = this.inner.isSupported && hasAudio;

    this.vad = new VadEngine({
      speechThreshold: options.speechThreshold ?? 0.02,
      speechMinFrames: options.speechMinFrames ?? 2,
      silenceTimeoutMs: options.silenceTimeoutMs ?? 1800,
      minSpeechDurationMs: options.minSpeechDurationMs ?? 400,
      onSpeechStart: () => {
        // Speech active
      },
      onSpeechEnd: () => {
        // Automatic end of speech detected via trailing silence
        void this.handleAutoCommit();
      },
      onAudioLevel: (level, isSpeech) => {
        this.userCallbacks?.onAudioLevel?.(level, isSpeech);
      },
      onSilenceCountdown: (remainingMs, totalMs) => {
        this.userCallbacks?.onSilenceCountdown?.(remainingMs, totalMs);
      },
    });
  }

  public getState(): SpeechInputState {
    return this.state;
  }

  public async start(callbacks?: SpeechInputStartCallbacks): Promise<void> {
    this.abort();
    this.userCallbacks = callbacks;
    this.state = "listening";
    this.userCallbacks?.onStateChange?.(this.state);

    // 1. Start audio monitoring via Web Audio API
    try {
      await this.startAudioStream();
      this.vad.startListening();
    } catch {
      // Degrade gracefully if microphone permissions failed for audio context
      // User can still speak via push-to-talk if inner supports it
    }

    // 2. Start underlying speech recognition
    await this.inner.start({
      onInterim: (text) => {
        this.userCallbacks?.onInterim?.(text);
      },
      onFinal: (text) => {
        this.userCallbacks?.onFinal?.(text);
      },
      onError: (err) => {
        this.stopAudioMonitoring();
        this.state = "idle";
        this.userCallbacks?.onStateChange?.(this.state);
        this.userCallbacks?.onError?.(err);
      },
      onStateChange: (innerState) => {
        if (innerState === "idle" && this.state === "listening") {
          // Inner stopped
          this.state = "idle";
          this.userCallbacks?.onStateChange?.(this.state);
        }
      },
    });
  }

  private async startAudioStream(): Promise<void> {
    const getUserMediaFn =
      this.customGetUserMedia ??
      (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia
        ? navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
        : undefined);

    if (!getUserMediaFn) return;

    this.mediaStream = await getUserMediaFn({ audio: true, video: false });

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!this.customAudioContext && !AudioContextClass) return;

    this.audioContext = this.customAudioContext ?? new AudioContextClass();
    const source = this.audioContext.createMediaStreamSource(this.mediaStream);

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 1024;
    source.connect(this.analyser);

    const buffer = new Float32Array(this.analyser.fftSize);

    const tick = () => {
      if (this.state !== "listening" || !this.analyser) return;

      this.analyser.getFloatTimeDomainData(buffer);
      this.vad.processFrame(buffer);

      if (typeof window !== "undefined" && window.requestAnimationFrame) {
        this.animationFrameId = window.requestAnimationFrame(tick);
      }
    };

    if (typeof window !== "undefined" && window.requestAnimationFrame) {
      this.animationFrameId = window.requestAnimationFrame(tick);
    }
  }

  private async handleAutoCommit(): Promise<void> {
    if (this.state !== "listening") return;
    await this.stop();
  }

  public async stop(): Promise<string> {
    this.state = "processing";
    this.userCallbacks?.onStateChange?.(this.state);
    this.stopAudioMonitoring();

    const transcript = await this.inner.stop();

    this.state = "idle";
    this.userCallbacks?.onStateChange?.(this.state);
    return transcript;
  }

  public abort(): void {
    this.state = "idle";
    this.stopAudioMonitoring();
    this.inner.abort();
  }

  private stopAudioMonitoring(): void {
    this.vad.reset();

    if (this.animationFrameId !== null && typeof window !== "undefined") {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
      this.mediaStream = null;
    }

    if (this.audioContext && !this.customAudioContext) {
      void this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.analyser = null;
  }
}
