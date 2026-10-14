// FR-030, ADR-021: Theme preference lives in the settings table (source of truth)
// with a localStorage mirror read by public/theme-init.js before first paint.
import {
  THEME_SETTING_KEY,
  readThemePreference,
  resolveTheme,
  type StorageAdapter,
  type ThemePreference,
} from "@abhyas/core";

// Keep in sync with public/theme-init.js, which runs before modules load.
const THEME_MIRROR_KEY = "abhyas.theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

export function mirrorThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_MIRROR_KEY, preference);
  } catch {
    // Mirror is best-effort only; private modes that block localStorage still
    // get the correct theme from the settings table once the app loads.
  }
}

export async function loadThemePreference(storage: StorageAdapter): Promise<ThemePreference> {
  const row = await storage.get<{ key: string; value: unknown }>("settings", THEME_SETTING_KEY);
  return readThemePreference(row?.value);
}

export async function saveThemePreference(
  storage: StorageAdapter,
  preference: ThemePreference
): Promise<void> {
  await storage.put("settings", { key: THEME_SETTING_KEY, value: preference });
  mirrorThemePreference(preference);
}

function systemPrefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

export function applyResolvedTheme(preference: ThemePreference): void {
  document.documentElement.setAttribute(
    "data-theme",
    resolveTheme(preference, systemPrefersDark())
  );
}

export function subscribeToSystemTheme(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
