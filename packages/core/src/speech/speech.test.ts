// FR-009, FR-010, NFR-023: Tests for core speech contracts, mocks, and settings schemas.
import { describe, expect, it } from "vitest";
import { MockSpeechInput, MockSpeechOutput } from "./index.js";
import {
  readShortcutsSettings,
  readSubtitleSettings,
  readVoiceSettings,
  VoiceSettingsSchema,
  SubtitleSettingsSchema,
  ShortcutsSettingsSchema,
} from "../settings.js";

describe("M1.6: Core Speech Contracts & Settings", () => {
  describe("MockSpeechInput", () => {
    it("manages states across start, interim results, final stop, and abort", async () => {
      const input = new MockSpeechInput({ transcript: "Custom candidate answer." });
      expect(input.isSupported).toBe(true);
      expect(input.getState()).toBe("idle");

      const interims: string[] = [];
      const finals: string[] = [];
      const stateChanges: string[] = [];

      await input.start({
        onInterim: (t) => interims.push(t),
        onFinal: (t) => finals.push(t),
        onStateChange: (s) => stateChanges.push(s),
      });

      expect(input.getState()).toBe("listening");
      expect(stateChanges).toContain("listening");

      input.emitInterim("Partial words...");
      expect(interims).toEqual(["Partial words..."]);

      const transcript = await input.stop();
      expect(transcript).toBe("Custom candidate answer.");
      expect(finals).toEqual(["Custom candidate answer."]);
      expect(input.getState()).toBe("idle");
    });

    it("emits error when unsupported or error occurs", async () => {
      const input = new MockSpeechInput({ isSupported: false });
      let capturedError: unknown = null;

      await input.start({
        onError: (err) => {
          capturedError = err;
        },
      });

      expect(capturedError).toEqual({
        kind: "not_supported",
        message: "Speech recognition is not supported in this environment.",
        retryable: false,
      });
    });
  });

  describe("MockSpeechOutput", () => {
    it("manages speech utterance, boundary events, and voice listing", async () => {
      const output = new MockSpeechOutput();
      expect(output.isSupported).toBe(true);
      expect(output.isSpeaking()).toBe(false);

      let ended = false;
      let boundaryChar = -1;

      await output.speak("Question text to be spoken.", {
        onBoundary: (idx) => {
          boundaryChar = idx;
        },
        onEnd: () => {
          ended = true;
        },
      });

      expect(output.getSpokenTexts()).toEqual(["Question text to be spoken."]);
      expect(ended).toBe(true);
      expect(boundaryChar).toBe(0);

      const voices = await output.getVoices();
      expect(voices.length).toBeGreaterThan(0);
      expect(voices[0]?.lang).toBe("en-US");
    });
  });

  describe("Voice and Subtitle Settings Schemas", () => {
    it("validates and falls back to default voice settings", () => {
      expect(readVoiceSettings(undefined)).toEqual({
        enabled: true,
        autoPlay: true,
        rate: 1.0,
      });

      const parsed = VoiceSettingsSchema.parse({
        enabled: false,
        autoPlay: false,
        rate: 1.2,
        voiceURI: "special-voice",
      });
      expect(parsed.rate).toBe(1.2);
      expect(parsed.voiceURI).toBe("special-voice");
    });

    it("validates and falls back to default subtitle settings", () => {
      expect(readSubtitleSettings(null)).toEqual({
        enabled: true,
        size: "M",
        highContrast: false,
      });

      const parsed = SubtitleSettingsSchema.parse({
        enabled: true,
        size: "L",
        highContrast: true,
      });
      expect(parsed.size).toBe("L");
      expect(parsed.highContrast).toBe(true);
    });

    it("validates and falls back to default shortcuts settings", () => {
      expect(readShortcutsSettings("invalid")).toEqual({ enabled: true });
      expect(ShortcutsSettingsSchema.parse({ enabled: false })).toEqual({ enabled: false });
    });

    it("persists and reads voice and subtitle settings using StorageAdapter", async () => {
      const { MemoryStorageAdapter } = await import("../storage/index.js");
      const storage = new MemoryStorageAdapter();

      // Read defaults
      const initialVoice = await (await import("../settings.js")).loadVoiceSettings(storage);
      expect(initialVoice.enabled).toBe(true);

      // Save custom
      await (
        await import("../settings.js")
      ).saveVoiceSettings(storage, {
        enabled: true,
        autoPlay: false,
        rate: 1.2,
      });
      const updatedVoice = await (await import("../settings.js")).loadVoiceSettings(storage);
      expect(updatedVoice.autoPlay).toBe(false);
      expect(updatedVoice.rate).toBe(1.2);

      // Subtitles
      const initialSubtitles = await (await import("../settings.js")).loadSubtitleSettings(storage);
      expect(initialSubtitles.size).toBe("M");

      await (
        await import("../settings.js")
      ).saveSubtitleSettings(storage, {
        enabled: true,
        size: "L",
        highContrast: true,
      });
      const updatedSubtitles = await (await import("../settings.js")).loadSubtitleSettings(storage);
      expect(updatedSubtitles.size).toBe("L");
      expect(updatedSubtitles.highContrast).toBe(true);
    });
  });
});
