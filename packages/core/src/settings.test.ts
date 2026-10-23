// FR-030: Theme preference resolution and loose settings-row parsing.
import { describe, expect, it } from "vitest";
import {
  readThemePreference,
  resolveTheme,
  readVoiceSettings,
  DEFAULT_VOICE_SETTINGS,
} from "./settings";

describe("M1.1: theme settings", () => {
  it("overridden preferences win regardless of system preference", () => {
    expect(resolveTheme("ink", false)).toBe("ink");
    expect(resolveTheme("ink", true)).toBe("ink");
    expect(resolveTheme("paper", true)).toBe("paper");
  });

  it("system preference follows the OS dark mode", () => {
    expect(resolveTheme("system", true)).toBe("ink");
    expect(resolveTheme("system", false)).toBe("paper");
  });

  it("falls back to system for missing or corrupt values", () => {
    expect(readThemePreference(undefined)).toBe("system");
    expect(readThemePreference("chartreuse")).toBe("system");
    expect(readThemePreference(null)).toBe("system");
    expect(readThemePreference("paper")).toBe("paper");
  });

  it("reads voice settings with defaults for VAD and speech engine", () => {
    expect(readVoiceSettings(undefined)).toEqual(DEFAULT_VOICE_SETTINGS);
    expect(
      readVoiceSettings({
        enabled: true,
        vadEnabled: true,
        silenceTimeoutMs: 2500,
        speechEngine: "on-device",
      })
    ).toEqual({
      enabled: true,
      autoPlay: true,
      rate: 1.0,
      vadEnabled: true,
      silenceTimeoutMs: 2500,
      speechEngine: "on-device",
    });
  });
});
