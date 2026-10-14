// FR-030: React binding for the persisted theme preference.
import { useCallback, useEffect, useState } from "react";
import type { StorageAdapter, ThemePreference } from "@abhyas/core";
import {
  applyResolvedTheme,
  loadThemePreference,
  saveThemePreference,
  subscribeToSystemTheme,
} from "./theme";

export function useTheme(storage: StorageAdapter | null) {
  const [preference, setPreference] = useState<ThemePreference>("system");

  useEffect(() => {
    if (!storage) return;
    let cancelled = false;
    void loadThemePreference(storage).then((loaded) => {
      if (!cancelled) setPreference(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [storage]);

  useEffect(() => {
    applyResolvedTheme(preference);
    if (preference !== "system") return undefined;
    return subscribeToSystemTheme(() => applyResolvedTheme("system"));
  }, [preference]);

  const setThemePreference = useCallback(
    async (next: ThemePreference) => {
      setPreference(next);
      if (storage) {
        await saveThemePreference(storage, next);
      }
    },
    [storage]
  );

  return { preference, setThemePreference };
}
