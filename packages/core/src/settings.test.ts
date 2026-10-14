// FR-030: Theme preference resolution and loose settings-row parsing.
import { describe, expect, it } from "vitest";
import { readThemePreference, resolveTheme } from "./settings";

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
});
