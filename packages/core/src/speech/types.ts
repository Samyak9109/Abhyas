// FR-009, FR-010, ADR-014: Core speech interfaces for voice input and output.
// Framework-free abstractions so interview features don't couple to DOM Speech APIs.

export type SpeechInputState = "idle" | "listening" | "processing";

export type SpeechInputErrorKind =
  | "not_allowed"
  | "no_speech"
  | "network"
  | "audio_capture"
  | "not_supported"
  | "aborted"
  | "unknown";

export interface SpeechInputError {
  kind: SpeechInputErrorKind;
  message: string;
  retryable: boolean;
}

export interface SpeechVoice {
  uri: string;
  name: string;
  lang: string;
  isDefault?: boolean | undefined;
}

export interface SpeechInputStartCallbacks {
  onInterim?: ((text: string) => void) | undefined;
  onFinal?: ((text: string) => void) | undefined;
  onError?: ((error: SpeechInputError) => void) | undefined;
  onStateChange?: ((state: SpeechInputState) => void) | undefined;
  onAudioLevel?: ((level: number, isSpeech: boolean) => void) | undefined;
  onSilenceCountdown?: ((remainingMs: number, totalMs: number) => void) | undefined;
}

/**
 * Speech recognition interface for capturing voice answers.
 */
export interface SpeechInput {
  readonly isSupported: boolean;
  getState(): SpeechInputState;
  start(callbacks?: SpeechInputStartCallbacks): Promise<void>;
  stop(): Promise<string>;
  abort(): void;
}

export interface SpeechOutputOptions {
  rate?: number | undefined; // 0.8 to 1.5 (default 1.0)
  pitch?: number | undefined;
  voiceURI?: string | undefined;
  onBoundary?: ((charIndex: number) => void) | undefined;
  onEnd?: (() => void) | undefined;
  onError?: ((error: Error) => void) | undefined;
}

/**
 * Speech synthesis interface for speaking interviewer prompts.
 */
export interface SpeechOutput {
  readonly isSupported: boolean;
  speak(text: string, options?: SpeechOutputOptions): Promise<void>;
  cancel(): void;
  pause(): void;
  resume(): void;
  isSpeaking(): boolean;
  getVoices(): Promise<SpeechVoice[]>;
}
