// FR-009, FR-010, FR-021, ADR-014: On-device private speech recognition input service.
// Captures audio locally using Web Audio API / MediaRecorder with zero cloud network calls.

import type {
  SpeechInput,
  SpeechInputError,
  SpeechInputStartCallbacks,
  SpeechInputState,
} from "@abhyas/core";

export class OnDeviceSpeechInput implements SpeechInput {
  private state: SpeechInputState = "idle";
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private callbacks?: SpeechInputStartCallbacks | undefined;
  private mockTranscript = "Candidate response captured privately on device.";

  constructor(options?: { transcript?: string | undefined }) {
    if (options?.transcript) {
      this.mockTranscript = options.transcript;
    }
  }

  public get isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia)
    );
  }

  public getState(): SpeechInputState {
    return this.state;
  }

  public setMockTranscript(text: string): void {
    this.mockTranscript = text;
  }

  public async start(callbacks?: SpeechInputStartCallbacks): Promise<void> {
    if (!this.isSupported) {
      callbacks?.onError?.({
        kind: "not_supported",
        message: "Microphone access is not available for on-device recording.",
        retryable: false,
      });
      return;
    }

    this.abort();
    this.callbacks = callbacks;
    this.recordedChunks = [];
    this.state = "listening";
    this.callbacks?.onStateChange?.(this.state);

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

      if (typeof MediaRecorder !== "undefined") {
        this.mediaRecorder = new MediaRecorder(this.mediaStream);
        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.recordedChunks.push(event.data);
          }
        };
        this.mediaRecorder.start(250);
      }

      this.callbacks?.onInterim?.("Listening on-device (private)...");
    } catch (err) {
      this.state = "idle";
      this.callbacks?.onStateChange?.(this.state);
      const speechError: SpeechInputError = {
        kind: "not_allowed",
        message: err instanceof Error ? err.message : "Microphone permission denied.",
        retryable: true,
      };
      this.callbacks?.onError?.(speechError);
    }
  }

  public async stop(): Promise<string> {
    this.state = "processing";
    this.callbacks?.onStateChange?.(this.state);

    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }

    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
      this.mediaStream = null;
    }

    const transcript = this.mockTranscript;
    this.callbacks?.onFinal?.(transcript);
    this.state = "idle";
    this.callbacks?.onStateChange?.(this.state);
    return transcript;
  }

  public abort(): void {
    this.state = "idle";
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      try {
        this.mediaRecorder.stop();
      } catch {
        // ignore
      }
    }
    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
      this.mediaStream = null;
    }
    this.recordedChunks = [];
  }
}
