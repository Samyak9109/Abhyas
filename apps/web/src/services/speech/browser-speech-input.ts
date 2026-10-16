// FR-009, ADR-014: Browser speech recognition service implementing SpeechInput.
// Uses webkitSpeechRecognition / SpeechRecognition with push-to-talk state management.
import type {
  SpeechInput,
  SpeechInputError,
  SpeechInputErrorKind,
  SpeechInputStartCallbacks,
  SpeechInputState,
} from "@abhyas/core";

// Minimal DOM SpeechRecognition declarations without external typings
interface SpeechRecognitionResultItem {
  readonly transcript: string;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionResultItem;
  [index: number]: SpeechRecognitionResultItem;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface ISpeechRecognitionEvent {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface ISpeechRecognitionErrorEvent {
  readonly error: string;
  readonly message?: string;
}

interface ISpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: ISpeechRecognitionEvent) => void) | null;
  onerror: ((event: ISpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionConstructor = new () => ISpeechRecognitionInstance;

function getSpeechRecognitionClass(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

export class BrowserSpeechInput implements SpeechInput {
  public readonly isSupported: boolean;
  private state: SpeechInputState = "idle";
  private recognition: ISpeechRecognitionInstance | null = null;
  private callbacks?: SpeechInputStartCallbacks | undefined;
  private accumulatedFinal = "";
  private currentInterim = "";

  constructor() {
    this.isSupported = Boolean(getSpeechRecognitionClass());
  }

  public getState(): SpeechInputState {
    return this.state;
  }

  public async start(callbacks?: SpeechInputStartCallbacks): Promise<void> {
    const RecognitionClass = getSpeechRecognitionClass();
    if (!RecognitionClass) {
      const err: SpeechInputError = {
        kind: "not_supported",
        message: "Speech recognition is not supported in this browser. Please use text mode.",
        retryable: false,
      };
      callbacks?.onError?.(err);
      return;
    }

    // Stop any existing session
    this.abort();

    this.callbacks = callbacks;
    this.accumulatedFinal = "";
    this.currentInterim = "";

    try {
      const recognition = new RecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        this.setState("listening");
      };

      recognition.onresult = (event: ISpeechRecognitionEvent) => {
        let interimStr = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (!res) continue;
          const transcript = res[0]?.transcript || "";
          if (res.isFinal) {
            this.accumulatedFinal = this.accumulatedFinal
              ? `${this.accumulatedFinal} ${transcript.trim()}`
              : transcript.trim();
          } else {
            interimStr += transcript;
          }
        }
        this.currentInterim = interimStr;

        if (this.callbacks?.onInterim) {
          const livePreview = this.accumulatedFinal
            ? `${this.accumulatedFinal} ${this.currentInterim}`.trim()
            : this.currentInterim.trim();
          this.callbacks.onInterim(livePreview);
        }
      };

      recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
        const classified = this.classifyError(event.error);
        this.setState("idle");
        this.callbacks?.onError?.(classified);
      };

      recognition.onend = () => {
        if (this.state === "listening") {
          // If stopped by external cause, return to idle
          this.setState("idle");
        }
      };

      this.recognition = recognition;
      recognition.start();
    } catch (e) {
      this.setState("idle");
      const err: SpeechInputError = {
        kind: "audio_capture",
        message: e instanceof Error ? e.message : "Failed to start audio recording.",
        retryable: true,
      };
      this.callbacks?.onError?.(err);
    }
  }

  public async stop(): Promise<string> {
    this.setState("processing");
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // ignore if already stopped
      }
    }

    const fullTranscript = (
      this.accumulatedFinal
        ? `${this.accumulatedFinal} ${this.currentInterim}`
        : this.currentInterim
    ).trim();

    this.callbacks?.onFinal?.(fullTranscript);
    this.setState("idle");
    this.cleanup();
    return fullTranscript;
  }

  public abort(): void {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // ignore
      }
    }
    this.setState("idle");
    this.cleanup();
  }

  private setState(next: SpeechInputState): void {
    this.state = next;
    this.callbacks?.onStateChange?.(next);
  }

  private cleanup(): void {
    if (this.recognition) {
      this.recognition.onstart = null;
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      this.recognition.onend = null;
      this.recognition = null;
    }
  }

  private classifyError(rawError: string): SpeechInputError {
    switch (rawError) {
      case "not-allowed":
      case "service-not-allowed":
        return {
          kind: "not_allowed",
          message:
            "Microphone permission was denied. Please allow microphone access in your browser settings.",
          retryable: false,
        };
      case "no-speech":
        return {
          kind: "no_speech",
          message: "No speech was detected. Please try speaking again.",
          retryable: true,
        };
      case "network":
        return {
          kind: "network",
          message: "Network error occurred during speech recognition.",
          retryable: true,
        };
      case "audio-capture":
        return {
          kind: "audio_capture",
          message: "No microphone detected or microphone is currently busy.",
          retryable: true,
        };
      case "aborted":
        return {
          kind: "aborted",
          message: "Speech recognition was stopped.",
          retryable: false,
        };
      default: {
        const kind: SpeechInputErrorKind = "unknown";
        return {
          kind,
          message: `Speech recognition error: ${rawError}`,
          retryable: true,
        };
      }
    }
  }
}
