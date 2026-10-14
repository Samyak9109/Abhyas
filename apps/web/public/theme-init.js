// FR-030, ADR-021: Applies the persisted theme before first paint to avoid a
// flash of the wrong theme. The settings table in IndexedDB is the source of
// truth; this mirror only exists because IndexedDB cannot be read synchronously.
(function () {
  var preference = "system";
  try {
    var raw = window.localStorage.getItem("abhyas.theme");
    if (raw === "system" || raw === "ink" || raw === "paper") {
      preference = raw;
    }
  } catch {
    // Blocked storage: fall back to the system preference.
  }
  var prefersDark = false;
  try {
    prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    // Very old engines: default to the light Paper theme.
  }
  var theme = preference === "system" ? (prefersDark ? "ink" : "paper") : preference;
  document.documentElement.setAttribute("data-theme", theme);
})();
