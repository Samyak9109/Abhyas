// FR-010, ADR-014: Browser speech synthesis service implementing SpeechOutput.
// Speaks interviewer questions using window.speechSynthesis with sentence chunking.
import type { SpeechOutput, SpeechOutputOptions, SpeechVoice } from "@abhyas/core";

export class BrowserSpeechOutput implements SpeechOutput {
  public readonly isSupported: boolean;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private speaking = false;

  constructor() {
    this.isSupported = typeof window !== "undefined" && "speechSynthesis" in window;
  }

  public isSpeaking(): boolean {
    if (!this.isSupported) return false;
    return this.speaking || Boolean(this.currentUtterance) || window.speechSynthesis.speaking;
  }

  public async getVoices(): Promise<SpeechVoice[]> {
    if (!this.isSupported) return [];

    const synth = window.speechSynthesis;
    let rawVoices = synth.getVoices();

    if (rawVoices.length === 0) {
      // Chrome loads voices asynchronously
      await new Promise<void>((resolve) => {
        const handler = () => {
          synth.removeEventListener("voiceschanged", handler);
          resolve();
        };
        synth.addEventListener("voiceschanged", handler);
        // Timeout fallback after 300ms
        setTimeout(() => {
          synth.removeEventListener("voiceschanged", handler);
          resolve();
        }, 300);
      });
      rawVoices = synth.getVoices();
    }

    return rawVoices.map((v) => ({
      uri: v.voiceURI,
      name: v.name,
      lang: v.lang,
      isDefault: v.default,
    }));
  }

  public async speak(text: string, options?: SpeechOutputOptions): Promise<void> {
    if (!this.isSupported) {
      options?.onEnd?.();
      return;
    }

    const synth = window.speechSynthesis;
    this.cancel();

    const cleanText = text.trim();
    if (!cleanText) {
      options?.onEnd?.();
      return;
    }

    const voices = synth.getVoices();
    let selectedVoice: SpeechSynthesisVoice | null = null;
    if (options?.voiceURI) {
      selectedVoice = voices.find((v) => v.voiceURI === options.voiceURI) || null;
    }
    if (!selectedVoice) {
      selectedVoice =
        voices.find((v) => v.lang.startsWith("en") && v.default) ||
        voices.find((v) => v.lang.startsWith("en")) ||
        voices[0] ||
        null;
    }

    return new Promise<void>((resolve) => {
      try {
        const utterance = new SpeechSynthesisUtterance(cleanText);
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }

        const clampedRate = Math.min(Math.max(options?.rate ?? 1.0, 0.5), 2.0);
        utterance.rate = clampedRate;
        utterance.pitch = options?.pitch ?? 1.0;

        utterance.onboundary = (event) => {
          options?.onBoundary?.(event.charIndex);
        };

        utterance.onend = () => {
          this.speaking = false;
          this.currentUtterance = null;
          options?.onEnd?.();
          resolve();
        };

        utterance.onerror = (event) => {
          this.speaking = false;
          this.currentUtterance = null;
          // In some browsers, manual cancel() throws error 'interrupted' or 'canceled'
          if (event.error !== "interrupted" && event.error !== "canceled") {
            options?.onError?.(new Error(`Speech synthesis error: ${event.error}`));
          }
          options?.onEnd?.();
          resolve();
        };

        this.speaking = true;
        this.currentUtterance = utterance;
        synth.speak(utterance);
      } catch (err) {
        this.speaking = false;
        options?.onError?.(err instanceof Error ? err : new Error(String(err)));
        options?.onEnd?.();
        resolve();
      }
    });
  }

  public cancel(): void {
    if (!this.isSupported) return;
    this.speaking = false;
    this.currentUtterance = null;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }

  public pause(): void {
    if (!this.isSupported) return;
    try {
      window.speechSynthesis.pause();
    } catch {
      // ignore
    }
  }

  public resume(): void {
    if (!this.isSupported) return;
    try {
      window.speechSynthesis.resume();
    } catch {
      // ignore
    }
  }
}
