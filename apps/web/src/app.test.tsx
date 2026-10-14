// FR-001, FR-030: App shell tests — init loading state, memory-mode banner, axe.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { axe } from "vitest-axe";
import { App } from "./App";

describe("M1.1: App shell", () => {
  it("loads storage and lands on settings with the memory banner in jsdom", async () => {
    render(<App />);
    // jsdom has no IndexedDB, so the app must boot into in-memory mode (FR-001).
    expect(await screen.findByText(/running in memory/i)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Settings" })).toBeTruthy();
  });

  it("has no axe violations once loaded", async () => {
    const { container } = render(<App />);
    await screen.findByText(/running in memory/i);
    expect(await axe(container)).toHaveNoViolations();
  });
});
