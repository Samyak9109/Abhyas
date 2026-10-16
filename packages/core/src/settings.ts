import { z } from "zod";
import type { StorageAdapter } from "./storage";

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

// --- Voice and Subtitles (FR-009, FR-010, PG-18) ---------------------------

export const VOICE_SETTINGS_KEY = "voice";

export const VoiceSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  autoPlay: z.boolean().default(true),
  rate: z.number().min(0.5).max(2.0).default(1.0),
  voiceURI: z.string().optional(),
});
export type VoiceSettings = z.infer<typeof VoiceSettingsSchema>;

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  enabled: true,
  autoPlay: true,
  rate: 1.0,
};

export function readVoiceSettings(value: unknown): VoiceSettings {
  const parsed = VoiceSettingsSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_VOICE_SETTINGS;
}

export async function loadVoiceSettings(storage: StorageAdapter): Promise<VoiceSettings> {
  const row = await storage.get<{ key: string; value: unknown }>("settings", VOICE_SETTINGS_KEY);
  return readVoiceSettings(row?.value);
}

export async function saveVoiceSettings(
  storage: StorageAdapter,
  settings: VoiceSettings
): Promise<void> {
  await storage.put("settings", { key: VOICE_SETTINGS_KEY, value: settings });
}

export const SUBTITLE_SETTINGS_KEY = "subtitles";

export const SubtitleSizeSchema = z.enum(["S", "M", "L"]);
export type SubtitleSize = z.infer<typeof SubtitleSizeSchema>;

export const SubtitleSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  size: SubtitleSizeSchema.default("M"),
  highContrast: z.boolean().default(false),
});
export type SubtitleSettings = z.infer<typeof SubtitleSettingsSchema>;

export const DEFAULT_SUBTITLE_SETTINGS: SubtitleSettings = {
  enabled: true,
  size: "M",
  highContrast: false,
};

export function readSubtitleSettings(value: unknown): SubtitleSettings {
  const parsed = SubtitleSettingsSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_SUBTITLE_SETTINGS;
}

export async function loadSubtitleSettings(storage: StorageAdapter): Promise<SubtitleSettings> {
  const row = await storage.get<{ key: string; value: unknown }>("settings", SUBTITLE_SETTINGS_KEY);
  return readSubtitleSettings(row?.value);
}

export async function saveSubtitleSettings(
  storage: StorageAdapter,
  settings: SubtitleSettings
): Promise<void> {
  await storage.put("settings", { key: SUBTITLE_SETTINGS_KEY, value: settings });
}

export const SHORTCUTS_SETTINGS_KEY = "shortcuts";

export const ShortcutsSettingsSchema = z.object({
  enabled: z.boolean().default(true),
});
export type ShortcutsSettings = z.infer<typeof ShortcutsSettingsSchema>;

export function readShortcutsSettings(value: unknown): ShortcutsSettings {
  const parsed = ShortcutsSettingsSchema.safeParse(value);
  return parsed.success ? parsed.data : { enabled: true };
}
