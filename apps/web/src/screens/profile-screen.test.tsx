// FR-002, FR-003, FR-004, PG-10: Tests for Profile & documents screen (M1.3).
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryStorageAdapter, type ProfileRow } from "@abhyas/core";
import { ProfileScreen } from "./ProfileScreen";

describe("M1.3: ProfileScreen (PG-10)", () => {
  it("renders with 5 experience levels, target role, and document inputs", async () => {
    const storage = new MemoryStorageAdapter();
    const onComplete = vi.fn();
    const onBack = vi.fn();

    render(<ProfileScreen storage={storage} onComplete={onComplete} onBack={onBack} />);

    // Header & Stepper
    expect(screen.getByText("Abhyas")).toBeTruthy();
    expect(screen.getByRole("link", { name: /abhyas home/i })).toBeTruthy();
    expect(screen.getByText("Profile")).toBeTruthy();

    // Title
    expect(screen.getByText("Your Profile & Role")).toBeTruthy();

    // 5 Experience Level Cards (FR-004)
    expect(screen.getByText("Intern / Fresher")).toBeTruthy();
    expect(screen.getByText("Junior (1–3 yrs)")).toBeTruthy();
    expect(screen.getByText("Mid-level (3–5 yrs)")).toBeTruthy();
    expect(screen.getByText("Senior (5–8 yrs)")).toBeTruthy();
    expect(screen.getByText("Staff+ (8+ yrs)")).toBeTruthy();

    // Target role input
    const roleInput = screen.getByLabelText(/Target Role or Title/i);
    expect(roleInput).toBeTruthy();
    expect(roleInput).toHaveProperty("value", "Frontend Engineer");

    // Dropzone
    expect(screen.getByLabelText(/Resume drop zone/i)).toBeTruthy();

    // Job description textarea
    expect(screen.getByLabelText(/Target Job Description/i)).toBeTruthy();
  });

  it("switches to paste mode and allows typing resume text", async () => {
    const storage = new MemoryStorageAdapter();
    const onComplete = vi.fn();
    const onBack = vi.fn();

    render(<ProfileScreen storage={storage} onComplete={onComplete} onBack={onBack} />);

    const pasteTab = screen.getByText("Paste Text");
    fireEvent.click(pasteTab);

    const resumeArea = screen.getByLabelText(/^Resume Text/i);
    expect(resumeArea).toBeTruthy();

    fireEvent.change(resumeArea, {
      target: {
        value: "Jane Doe\nExperienced React and TypeScript engineer with cloud background.",
      },
    });

    expect(resumeArea).toHaveProperty(
      "value",
      "Jane Doe\nExperienced React and TypeScript engineer with cloud background."
    );
  });

  it("extracts profile skills and displays editable pills and gaps (FR-003)", async () => {
    const storage = new MemoryStorageAdapter();
    const onComplete = vi.fn();
    const onBack = vi.fn();

    render(<ProfileScreen storage={storage} onComplete={onComplete} onBack={onBack} />);

    // Switch to paste
    fireEvent.click(screen.getByText("Paste Text"));
    const resumeArea = screen.getByLabelText(/^Resume Text/i);
    fireEvent.change(resumeArea, {
      target: {
        value: `
          Alex Rivera
          Staff Software Engineer
          Skills: React, TypeScript, Node.js, PostgreSQL, Docker
          - Spearheaded cloud architecture migration, improving throughput by 50%
        `,
      },
    });

    const jdArea = screen.getByLabelText(/Target Job Description/i);
    fireEvent.change(jdArea, {
      target: {
        value: "Required: React, TypeScript, Kubernetes, AWS, GraphQL",
      },
    });

    // Click Analyze Profile & Skills
    const analyzeBtn = screen.getByText(/Analyze Profile & Skills/i);
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      expect(screen.getByText(/Profile Analysis/i)).toBeTruthy();
    });

    // Check extracted skills
    expect(screen.getByText("frontend")).toBeTruthy();
    expect(screen.getByText("databases")).toBeTruthy();

    // Check detected JD gaps
    expect(screen.getByText("kubernetes")).toBeTruthy();
    expect(screen.getByText("aws")).toBeTruthy();

    // Remove a skill
    const removeBtn = screen.getByLabelText("Remove skill frontend");
    fireEvent.click(removeBtn);
    expect(screen.queryByText("frontend")).toBeNull();

    // Add a manual skill
    const addInput = screen.getByPlaceholderText(/Add another skill/i);
    fireEvent.change(addInput, { target: { value: "GraphQL" } });
    fireEvent.click(screen.getByText("Add Skill"));

    expect(screen.getByText("GraphQL")).toBeTruthy();
  });

  it("toggles role-only mode hiding resume and JD inputs (FR-002, PG-10)", async () => {
    const storage = new MemoryStorageAdapter();
    const onComplete = vi.fn();
    const onBack = vi.fn();

    render(<ProfileScreen storage={storage} onComplete={onComplete} onBack={onBack} />);

    const toggle = screen.getByRole("switch", { name: /Role only mode/i });
    fireEvent.click(toggle);

    expect(screen.getByText(/Role-Only Mode Active/i)).toBeTruthy();
    expect(screen.queryByLabelText(/Resume drop zone/i)).toBeNull();
  });

  it("validates required target role and saves profile on continue (FR-004)", async () => {
    const storage = new MemoryStorageAdapter();
    const onComplete = vi.fn();
    const onBack = vi.fn();

    render(<ProfileScreen storage={storage} onComplete={onComplete} onBack={onBack} />);

    // Clear role input to trigger validation error
    const roleInput = screen.getByLabelText(/Target Role or Title/i);
    fireEvent.change(roleInput, { target: { value: "" } });

    fireEvent.click(screen.getByText(/Continue to Session Setup/i));

    expect(screen.getByText(/Target role is required/i)).toBeTruthy();
    expect(onComplete).not.toHaveBeenCalled();

    // Now fill role and select Senior level
    fireEvent.change(roleInput, { target: { value: "Principal Distributed Systems Engineer" } });
    fireEvent.click(screen.getByText("Senior (5–8 yrs)"));

    fireEvent.click(screen.getByText(/Continue to Session Setup/i));

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    // Check IndexedDB storage was populated
    const profiles = await storage.getAll<ProfileRow>("profile");
    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.targetRole).toBe("Principal Distributed Systems Engineer");
    expect(profiles[0]?.level).toBe("senior");
  });

  describe("Accessibility (axe)", () => {
    it("has zero axe violations under Ink theme in default state", async () => {
      const storage = new MemoryStorageAdapter();
      const { container } = render(
        <div data-theme="ink">
          <ProfileScreen storage={storage} onComplete={vi.fn()} onBack={vi.fn()} />
        </div>
      );

      const results = await axe(container);
      expect(results.violations).toEqual([]);
    });

    it("has zero axe violations under Paper theme in default state", async () => {
      const storage = new MemoryStorageAdapter();
      const { container } = render(
        <div data-theme="paper">
          <ProfileScreen storage={storage} onComplete={vi.fn()} onBack={vi.fn()} />
        </div>
      );

      const results = await axe(container);
      expect(results.violations).toEqual([]);
    });
  });
});
