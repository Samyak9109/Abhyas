// FR-009, FR-010: Web speech services exports and singleton accessors.
import { BrowserSpeechInput } from "./browser-speech-input.js";
import { BrowserSpeechOutput } from "./browser-speech-output.js";

export * from "./browser-speech-input.js";
export * from "./browser-speech-output.js";

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
