// FR-009, FR-010, NFR-023: In-memory mock speech adapters for tests and Node runtimes.
import type {
  SpeechInput,
  SpeechInputError,
  SpeechInputStartCallbacks,
  SpeechInputState,
  SpeechOutput,
  SpeechOutputOptions,
  SpeechVoice,
} from "./types.js";

export class MockSpeechInput implements SpeechInput {
  public isSupported = true;
  private state: SpeechInputState = "idle";
  private callbacks?: SpeechInputStartCallbacks | undefined;
  private scriptedTranscript = "This is a mocked candidate voice answer.";

  constructor(options?: { isSupported?: boolean | undefined; transcript?: string | undefined }) {
    if (options?.isSupported !== undefined) this.isSupported = options.isSupported;
    if (options?.transcript !== undefined) this.scriptedTranscript = options.transcript;
  }

  public getState(): SpeechInputState {
    return this.state;
  }

  public setScriptedTranscript(text: string): void {
    this.scriptedTranscript = text;
  }

  public async start(callbacks?: SpeechInputStartCallbacks): Promise<void> {
    if (!this.isSupported) {
      callbacks?.onError?.({
        kind: "not_supported",
        message: "Speech recognition is not supported in this environment.",
        retryable: false,
      });
      return;
    }
    this.callbacks = callbacks;
    this.state = "listening";
    this.callbacks?.onStateChange?.(this.state);
  }

  public emitInterim(partialText: string): void {
    if (this.state === "listening") {
      this.callbacks?.onInterim?.(partialText);
    }
  }

  public emitError(error: SpeechInputError): void {
    this.state = "idle";
    this.callbacks?.onStateChange?.(this.state);
    this.callbacks?.onError?.(error);
  }

  public async stop(): Promise<string> {
    this.state = "processing";
    this.callbacks?.onStateChange?.(this.state);
    this.callbacks?.onFinal?.(this.scriptedTranscript);
    this.state = "idle";
    this.callbacks?.onStateChange?.(this.state);
    return this.scriptedTranscript;
  }

  public abort(): void {
    this.state = "idle";
    this.callbacks?.onStateChange?.(this.state);
  }
}

export class MockSpeechOutput implements SpeechOutput {
  public isSupported = true;
  private speaking = false;
  private spokenTexts: string[] = [];
  private voices: SpeechVoice[] = [
    { uri: "mock-voice-1", name: "Mock English Voice", lang: "en-US", isDefault: true },
    { uri: "mock-voice-2", name: "Mock British Voice", lang: "en-GB" },
  ];

  constructor(options?: { isSupported?: boolean | undefined; voices?: SpeechVoice[] | undefined }) {
    if (options?.isSupported !== undefined) this.isSupported = options.isSupported;
    if (options?.voices !== undefined) this.voices = options.voices;
  }

  public isSpeaking(): boolean {
    return this.speaking;
  }

  public getSpokenTexts(): string[] {
    return [...this.spokenTexts];
  }

  public clearSpokenTexts(): void {
    this.spokenTexts = [];
  }

  public async speak(text: string, options?: SpeechOutputOptions): Promise<void> {
    if (!this.isSupported) {
      options?.onError?.(new Error("Speech synthesis is not supported."));
      return;
    }
    this.speaking = true;
    this.spokenTexts.push(text);
    options?.onBoundary?.(0);
    this.speaking = false;
    options?.onEnd?.();
  }

  public cancel(): void {
    this.speaking = false;
  }

  public pause(): void {
    // mock no-op
  }

  public resume(): void {
    // mock no-op
  }

  public async getVoices(): Promise<SpeechVoice[]> {
    return [...this.voices];
  }
}
