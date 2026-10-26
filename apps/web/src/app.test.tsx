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

  it("navigates to session setup via aside navigation link", async () => {
    render(<App />);
    await screen.findByText(/running in memory/i);

    const sessionLink = screen.getByRole("link", { name: /^session/i });
    fireEvent.click(sessionLink);

    expect(await screen.findByRole("heading", { name: /set up your session/i })).toBeTruthy();
  });

  it("renders empty state fallback with setup CTA when /app/interview has no active session", async () => {
    window.history.pushState({}, "", "/app/interview");
    render(<App />);

    expect(await screen.findByText(/no active interview session/i)).toBeTruthy();
    const cta = screen.getByRole("button", { name: /go to session setup/i });
    fireEvent.click(cta);

    expect(await screen.findByRole("heading", { name: /set up your session/i })).toBeTruthy();
  });

  it("navigates to Home screen via aside navigation link", async () => {
    render(<App />);
    await screen.findByText(/running in memory/i);

    const homeLink = screen.getByRole("link", { name: /^home/i });
    fireEvent.click(homeLink);

    expect(
      await screen.findByRole("heading", { name: /welcome to your practice studio/i })
    ).toBeTruthy();
  });

  it("navigates to Home screen when clicking the logo in the navigation aside", async () => {
    render(<App />);
    await screen.findByText(/running in memory/i);

    const logoLink = screen.getByRole("link", { name: /abhyas home/i });
    fireEvent.click(logoLink);

    expect(
      await screen.findByRole("heading", { name: /welcome to your practice studio/i })
    ).toBeTruthy();
  });

  it("navigates to Skills Dashboard via aside navigation link", async () => {
    render(<App />);
    await screen.findByText(/running in memory/i);

    const skillsLink = screen.getByRole("link", { name: /^skills/i });
    fireEvent.click(skillsLink);

    expect(await screen.findByRole("heading", { name: "Skills Dashboard_" })).toBeTruthy();
    expect(screen.getByText("No interview data yet")).toBeTruthy();
  });

  it("navigates to Practice screen via aside navigation link", async () => {
    render(<App />);
    await screen.findByText(/running in memory/i);

    const practiceLink = screen.getByRole("link", { name: /^practice/i });
    fireEvent.click(practiceLink);

    expect(await screen.findByRole("heading", { name: "Skill Practice_" })).toBeTruthy();
  });

  it("navigates to History screen via aside navigation link", async () => {
    render(<App />);
    await screen.findByText(/running in memory/i);

    const historyLink = screen.getByRole("link", { name: /^history/i });
    fireEvent.click(historyLink);

    expect(await screen.findByRole("heading", { name: "History & Transcripts" })).toBeTruthy();
  });

  it("navigates to Models screen via aside navigation link", async () => {
    render(<App />);
    await screen.findByText(/running in memory/i);

    const modelsLink = screen.getByRole("link", { name: /^models/i });
    fireEvent.click(modelsLink);

    expect(await screen.findByRole("heading", { name: /in-browser model manager/i })).toBeTruthy();
  });

  it("navigates to Companies screen via aside navigation link", async () => {
    render(<App />);
    await screen.findByText(/running in memory/i);

    const companiesLink = screen.getByRole("link", { name: /^companies/i });
    fireEvent.click(companiesLink);

    expect(await screen.findByRole("heading", { name: /Company Directory_/i })).toBeTruthy();
  });

  it("renders Results screen when navigating to /app/results", async () => {
    window.history.pushState({}, "", "/app/results");
    render(<App />);

    expect(await screen.findByText(/session not found/i)).toBeTruthy();
  });

  it("has no axe violations once loaded", async () => {
    const { container } = render(<App />);
    await screen.findByText(/running in memory/i);
    expect(await axe(container)).toHaveNoViolations();
  });
});
