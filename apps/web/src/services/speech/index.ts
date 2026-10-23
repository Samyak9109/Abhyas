// FR-009, FR-010, FR-021, ADR-014: Web speech services exports and factory accessors.
import type { VoiceSettings, SpeechInput } from "@abhyas/core";
import { BrowserSpeechInput } from "./browser-speech-input.js";
import { BrowserSpeechOutput } from "./browser-speech-output.js";
import { HandsFreeSpeechInput } from "./handsfree-speech-input.js";
import { OnDeviceSpeechInput } from "./on-device-speech-input.js";

export * from "./browser-speech-input.js";
export * from "./browser-speech-output.js";
export * from "./handsfree-speech-input.js";
export * from "./on-device-speech-input.js";

let defaultInput: BrowserSpeechInput | null = null;
let defaultOutput: BrowserSpeechOutput | null = null;

export function getBrowserSpeechInput(): BrowserSpeechInput {
  if (!defaultInput) {
    defaultInput = new BrowserSpeechInput();
  }
  return defaultInput;
}

export function getBrowserSpeechOutput(): BrowserSpeechOutput {
  if (!defaultOutput) {
    defaultOutput = new BrowserSpeechOutput();
  }
  return defaultOutput;
}

/**
 * Creates or wraps a SpeechInput according to user's configured VoiceSettings.
 * Handles VAD (hands-free) and engine selection (browser native vs on-device).
 */
export function createConfiguredSpeechInput(settings?: VoiceSettings): SpeechInput {
  const isPrivate = settings?.speechEngine === "on-device";
  const baseInput: SpeechInput = isPrivate ? new OnDeviceSpeechInput() : getBrowserSpeechInput();

  if (settings?.vadEnabled) {
    return new HandsFreeSpeechInput({
      innerInput: baseInput,
      silenceTimeoutMs: settings.silenceTimeoutMs,
    });
  }

  return baseInput;
}
