// FR-030, ADR-021: Theme preference resolution. Ink is the dark default theme,
// Paper is light; "system" follows the OS preference (design.md 6.2a).
import { z } from "zod";

export const THEME_SETTING_KEY = "theme";

export const ThemePreferenceSchema = z.enum(["system", "ink", "paper"]);
export type ThemePreference = z.infer<typeof ThemePreferenceSchema>;

export type ResolvedTheme = "ink" | "paper";

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  if (preference === "system") return prefersDark ? "ink" : "paper";
  return preference;
}

// Settings rows are validated loosely (value: unknown); known keys get a strict
// parse so a corrupt or foreign value falls back to the default instead of
// crashing theme resolution.
export function readThemePreference(value: unknown): ThemePreference {
  const parsed = ThemePreferenceSchema.safeParse(value);
  return parsed.success ? parsed.data : "system";
}
