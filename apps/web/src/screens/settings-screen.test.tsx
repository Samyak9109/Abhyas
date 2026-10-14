// FR-020, FR-030, NFR-011: Settings screen tests — sections, theme persistence,
// export schema validity, typed delete confirmation, banners, axe in both themes.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  MemoryStorageAdapter,
  parseExport,
  type StorageAdapter,
  type ThemePreference,
} from "@abhyas/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { useTheme } from "../services/use-theme";
import { SettingsScreen } from "./SettingsScreen";

function renderScreen(overrides: Partial<Parameters<typeof SettingsScreen>[0]> = {}) {
  const storage = new MemoryStorageAdapter();
  const props = {
    storage,
    mode: "persistent" as const,
    quotaExceeded: false,
    themePreference: "system" as ThemePreference,
    onThemeChange: () => undefined,
    onWriteError: () => undefined,
    onDataDeleted: () => undefined,
    ...overrides,
  };
  return { storage, ...render(<SettingsScreen {...props} />), props };
}

// Wires the screen to the real theme hook and storage, like the app does.
function ThemeHarness({ storage }: { storage: StorageAdapter }) {
  const { preference, setThemePreference } = useTheme(storage);
  return (
    <SettingsScreen
      storage={storage}
      mode="persistent"
      quotaExceeded={false}
      themePreference={preference}
      onThemeChange={(next) => void setThemePreference(next)}
      onWriteError={() => undefined}
      onDataDeleted={() => undefined}
    />
  );
}

afterEach(() => {
  document.documentElement.setAttribute("data-theme", "ink");
  vi.restoreAllMocks();
});

describe("M1.1: Settings screen", () => {
  it("renders Appearance and Data sections with theme choices", () => {
    renderScreen();
    expect(screen.getByRole("heading", { name: "Settings" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Appearance" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Data" })).toBeTruthy();

    const group = screen.getByRole("radiogroup", { name: "Theme" });
    expect(group.querySelectorAll('[role="radio"]')).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Export data" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete all…" })).toBeTruthy();
  });

  it("requests a theme change when a theme card is chosen", () => {
    const onThemeChange = vi.fn();
    renderScreen({ onThemeChange });
    fireEvent.click(screen.getByRole("radio", { name: /Paper/ }));
    expect(onThemeChange).toHaveBeenCalledWith("paper");
  });

  it("moves focus between theme cards with arrow keys", () => {
    renderScreen();
    const group = screen.getByRole("radiogroup", { name: "Theme" });
    const radios = Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]'));

    radios[0]?.focus();
    fireEvent.keyDown(group, { key: "ArrowDown" });
    expect(document.activeElement).toBe(radios[1]);
    fireEvent.keyDown(group, { key: "ArrowUp" });
    expect(document.activeElement).toBe(radios[0]);
    fireEvent.keyDown(group, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(radios[2]);
  });

  it("persists the theme choice to storage and applies it to the document", async () => {
    const storage = new MemoryStorageAdapter();
    render(<ThemeHarness storage={storage} />);

    fireEvent.click(await screen.findByRole("radio", { name: /Paper/ }));

    await waitFor(
      async () => {
        expect(await storage.get("settings", "theme")).toEqual({ key: "theme", value: "paper" });
      },
      { timeout: 3000 }
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe("paper");
    expect(window.localStorage.getItem("abhyas.theme")).toBe("paper");
  });

  it("downloads an export file that validates against the export schema", async () => {
    const createdUrls: string[] = [];
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: (blob: Blob) => {
        createdUrls.push("blob:mock");
        (createdUrls as { blob?: Blob }).blob = blob;
        return "blob:mock";
      },
      revokeObjectURL: vi.fn(),
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const { storage } = renderScreen();
    await storage.put("profile", {
      id: "prof_1",
      level: "senior",
      targetRole: "Staff Engineer",
      updatedAt: "2026-10-14T00:00:00.000Z",
    });
    await storage.put("providers", {
      id: "gemini",
      kind: "gemini",
      modelRoles: { interviewer: "m", evaluator: "m" },
      key: "SECRET_KEY_MATERIAL",
    });

    fireEvent.click(screen.getByRole("button", { name: "Export data" }));

    await waitFor(() => expect(clickSpy).toHaveBeenCalled(), { timeout: 3000 });
    const blob = (createdUrls as { blob?: Blob }).blob;
    expect(blob).toBeTruthy();
    // jsdom Blobs do not interoperate with Response#text(); FileReader does.
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(blob!);
    });

    expect(text).not.toContain("SECRET_KEY_MATERIAL");
    const parsed = parseExport(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data.tables.profile[0]?.targetRole).toBe("Staff Engineer");
    }
    expect(screen.getByText(/Export downloaded/)).toBeTruthy();
  });

  it("requires the typed phrase before delete-all enables", async () => {
    const onDataDeleted = vi.fn();
    const { storage } = renderScreen({ onDataDeleted });
    await storage.put("sessions", {
      id: "s1",
      startedAt: "2026-10-14T00:00:00.000Z",
      status: "completed",
      plan: null,
      modality: "text",
      level: "junior",
      providerId: "gemini",
      modelId: "m",
      schemaVersion: 1,
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete all…" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("permanently erases");
    const confirm = screen.getByRole("button", { name: "Delete everything" });
    expect(confirm).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByLabelText(/Type DELETE to confirm/), {
      target: { value: "DELET" },
    });
    expect(confirm).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByLabelText(/Type DELETE to confirm/), {
      target: { value: "DELETE" },
    });
    expect(confirm).toHaveProperty("disabled", false);

    fireEvent.click(confirm);

    await waitFor(
      async () => {
        expect(await storage.getAll("sessions")).toEqual([]);
        expect(await storage.getAll("settings")).toEqual([]);
      },
      { timeout: 3000 }
    );
    expect(screen.getByText("All data deleted from this browser.")).toBeTruthy();
    expect(onDataDeleted).toHaveBeenCalled();
  });

  it("keeps focus in the confirm input while typing and submits on Enter", async () => {
    const { storage } = renderScreen();
    await storage.put("sessions", {
      id: "s1",
      startedAt: "2026-10-14T00:00:00.000Z",
      status: "completed",
      plan: null,
      modality: "text",
      level: "junior",
      providerId: "gemini",
      modelId: "m",
      schemaVersion: 1,
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete all…" }));
    const input = screen.getByLabelText(/Type DELETE to confirm/) as HTMLInputElement;
    expect(document.activeElement).toBe(input);

    for (const char of "DELET") {
      fireEvent.change(input, { target: { value: input.value + char } });
      // NFR-011: parent re-renders must not steal focus back to the dialog chrome.
      expect(document.activeElement).toBe(input);
    }
    expect(input.value).toBe("DELET");

    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(await storage.getAll("sessions")).toHaveLength(1);

    fireEvent.change(input, { target: { value: "DELETE" } });
    expect(document.activeElement).toBe(input);
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(
      async () => {
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(await storage.getAll("sessions")).toEqual([]);
      },
      { timeout: 3000 }
    );
    expect(screen.getByText("All data deleted from this browser.")).toBeTruthy();
  });

  it("shows the in-memory banner when storage is unavailable", () => {
    renderScreen({ mode: "memory" });
    expect(screen.getByText(/running in memory/)).toBeTruthy();
  });

  it("shows the storage-full banner and offers export", () => {
    renderScreen({ quotaExceeded: true });
    expect(screen.getByText(/storage is full/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Export now" })).toBeTruthy();
  });

  describe.each(["ink", "paper"] as const)("theme %s", (theme) => {
    it("has no axe violations in the default state", async () => {
      const { container } = render(
        <div data-theme={theme}>
          <SettingsScreen
            storage={new MemoryStorageAdapter()}
            mode="memory"
            quotaExceeded={false}
            themePreference="system"
            onThemeChange={() => undefined}
            onWriteError={() => undefined}
            onDataDeleted={() => undefined}
          />
        </div>
      );
      expect(await axe(container)).toHaveNoViolations();
    });

    it("has no axe violations with the delete dialog open", async () => {
      const { container, getByRole } = render(
        <div data-theme={theme}>
          <SettingsScreen
            storage={new MemoryStorageAdapter()}
            mode="persistent"
            quotaExceeded={false}
            themePreference="system"
            onThemeChange={() => undefined}
            onWriteError={() => undefined}
            onDataDeleted={() => undefined}
          />
        </div>
      );
      fireEvent.click(getByRole("button", { name: "Delete all…" }));
      expect(await axe(container)).toHaveNoViolations();
    });
  });
});
