// FR-009, FR-010: Tests for BrowserSpeechInput and BrowserSpeechOutput.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserSpeechInput } from "./browser-speech-input";
import { BrowserSpeechOutput } from "./browser-speech-output";

describe("M1.6: Browser Speech Services", () => {
  describe("BrowserSpeechInput without SpeechRecognition", () => {
    it("reports unsupported and returns not_supported error on start", async () => {
      const input = new BrowserSpeechInput();
      expect(input.isSupported).toBe(false);

      let capturedError: unknown = null;
      await input.start({
        onError: (err) => {
          capturedError = err;
        },
      });

      expect(capturedError).toMatchObject({
        kind: "not_supported",
        retryable: false,
      });
    });
  });

  describe("BrowserSpeechInput with mock SpeechRecognition", () => {
    let mockInstance: {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onstart: (() => void) | null;
      onresult: ((ev: unknown) => void) | null;
      onerror: ((ev: unknown) => void) | null;
      onend: (() => void) | null;
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
      abort: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockInstance = {
        continuous: false,
        interimResults: false,
        lang: "",
        onstart: null,
        onresult: null,
        onerror: null,
        onend: null,
        start: vi.fn(),
        stop: vi.fn(),
        abort: vi.fn(),
      };

      (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = vi.fn(
        () => mockInstance
      );
    });

    afterEach(() => {
      delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
    });

    it("starts recognition, processes interim and final results, and stops", async () => {
      const input = new BrowserSpeechInput();
      expect(input.isSupported).toBe(true);

      const interims: string[] = [];
      const finals: string[] = [];
      const states: string[] = [];

      await input.start({
        onInterim: (t) => interims.push(t),
        onFinal: (t) => finals.push(t),
        onStateChange: (s) => states.push(s),
      });

      expect(mockInstance.start).toHaveBeenCalled();

      // Trigger start callback
      mockInstance.onstart?.();
      expect(input.getState()).toBe("listening");
      expect(states).toContain("listening");

      // Trigger interim result
      mockInstance.onresult?.({
        resultIndex: 0,
        results: [
          {
            isFinal: false,
            0: { transcript: "I think" },
          },
        ],
      });
      expect(interims).toEqual(["I think"]);

      // Trigger final result
      mockInstance.onresult?.({
        resultIndex: 0,
        results: [
          {
            isFinal: true,
            0: { transcript: "I think React is great." },
          },
        ],
      });

      const finalOutput = await input.stop();
      expect(finalOutput).toBe("I think React is great.");
      expect(finals).toContain("I think React is great.");
      expect(input.getState()).toBe("idle");
    });

    it("classifies not-allowed error when microphone permission is denied", async () => {
      const input = new BrowserSpeechInput();
      let errorKind = "";

      await input.start({
        onError: (err) => {
          errorKind = err.kind;
        },
      });

      mockInstance.onerror?.({ error: "not-allowed" });
      expect(errorKind).toBe("not_allowed");
      expect(input.getState()).toBe("idle");
    });
  });

  describe("BrowserSpeechOutput with mock SpeechSynthesis", () => {
    let originalSynth: unknown;
    let spokenUtterances: SpeechSynthesisUtterance[] = [];

    beforeEach(() => {
      originalSynth = window.speechSynthesis;
      spokenUtterances = [];

      class MockUtterance {
        text: string;
        rate = 1;
        pitch = 1;
        voice: SpeechSynthesisVoice | null = null;
        onboundary: ((ev: { charIndex: number }) => void) | null = null;
        onend: ((ev: unknown) => void) | null = null;
        onerror: ((ev: unknown) => void) | null = null;
        constructor(text: string) {
          this.text = text;
        }
      }
      (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance =
        MockUtterance;

      window.speechSynthesis = {
        speaking: false,
        paused: false,
        pending: false,
        onvoiceschanged: null,
        getVoices: () => [
          {
            voiceURI: "voice-en-1",
            name: "Samantha",
            lang: "en-US",
            default: true,
            localService: true,
          } as SpeechSynthesisVoice,
        ],
        speak: vi.fn((utterance: SpeechSynthesisUtterance) => {
          spokenUtterances.push(utterance);
          // Simulate immediate end
          setTimeout(() => {
            utterance.onend?.(new Event("end") as SpeechSynthesisEvent);
          }, 0);
        }),
        cancel: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as unknown as SpeechSynthesis;
    });

    afterEach(() => {
      window.speechSynthesis = originalSynth as SpeechSynthesis;
      delete (window as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance;
    });

    it("speaks text, sets rate and voice, and triggers onEnd", async () => {
      const output = new BrowserSpeechOutput();
      expect(output.isSupported).toBe(true);

      let ended = false;
      await output.speak("Hello world, this is a test question.", {
        rate: 1.1,
        voiceURI: "voice-en-1",
        onEnd: () => {
          ended = true;
        },
      });

      expect(ended).toBe(true);
      expect(spokenUtterances.length).toBe(1);
      expect(spokenUtterances[0]?.text).toBe("Hello world, this is a test question.");
      expect(spokenUtterances[0]?.rate).toBe(1.1);
    });

    it("cancels active synthesis on cancel()", () => {
      const output = new BrowserSpeechOutput();
      output.cancel();
      expect(window.speechSynthesis.cancel).toHaveBeenCalled();
    });

    it("retrieves available voices", async () => {
      const output = new BrowserSpeechOutput();
      const voices = await output.getVoices();
      expect(voices.length).toBe(1);
      expect(voices[0]?.name).toBe("Samantha");
      expect(voices[0]?.lang).toBe("en-US");
    });
  });
});
