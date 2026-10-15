// FR-001, FR-030: App shell tests — init loading state, memory-mode banner, axe.
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { App } from "./App";

describe("M1.1: App shell", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/app/settings");
  });

  it("loads storage and lands on settings with the memory banner in jsdom", async () => {
    render(<App />);
    // jsdom has no IndexedDB, so the app must boot into in-memory mode (FR-001).
    expect(await screen.findByText(/running in memory/i)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Settings" })).toBeTruthy();
  });

  it("navigates between Settings, AI Setup, and Profile screens", async () => {
    render(<App />);
    await screen.findByText(/running in memory/i);

    const aiSetupLink = screen.getByRole("link", { name: /ai setup/i });
    fireEvent.click(aiSetupLink);

    expect(await screen.findByRole("heading", { name: /choose your ai source/i })).toBeTruthy();

    const settingsBtn = screen.getByRole("button", { name: /settings/i });
    fireEvent.click(settingsBtn);

    expect(await screen.findByRole("heading", { name: "Settings" })).toBeTruthy();

    const profileLink = screen.getByRole("link", { name: /^profile/i });
    fireEvent.click(profileLink);

    expect(await screen.findByRole("heading", { name: /your profile & role/i })).toBeTruthy();
  });

  it("renders Session Setup screen when URL is /app/setup/session", async () => {
    window.history.pushState({}, "", "/app/setup/session");
    render(<App />);
    expect(await screen.findByRole("heading", { name: /set up your session/i })).toBeTruthy();
  });

  it("has no axe violations once loaded", async () => {
    const { container } = render(<App />);
    await screen.findByText(/running in memory/i);
    expect(await axe(container)).toHaveNoViolations();
  });
});
