// FR-027, ADR-012, PG-22: Tests for ScheduleScreen.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryStorageAdapter } from "@abhyas/core";
import { ScheduleScreen } from "./ScheduleScreen";

describe("PG-22: ScheduleScreen (M6.1)", () => {
  it("renders with rolling schedule when no date is set", async () => {
    const storage = new MemoryStorageAdapter();
    render(<ScheduleScreen storage={storage} />);

    await waitFor(() => {
      expect(screen.getByText("Interview Schedule & Prep Plan")).toBeTruthy();
    });

    expect(screen.getByText(/Rolling 2-Week Plan/i)).toBeTruthy();
    expect(
      screen.getByText(/No date set: showing a generic 2-week rolling preparation plan/i)
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /Export \.ics Calendar/i })).toBeTruthy();
  });

  it("updates plan and ramps difficulty when a future interview date is entered", async () => {
    const storage = new MemoryStorageAdapter();
    render(<ScheduleScreen storage={storage} />);

    await waitFor(() => {
      expect(screen.getByText("Interview Schedule & Prep Plan")).toBeTruthy();
    });

    const dateInput = screen.getByLabelText("Target Interview Date");

    // Enter date 30 days in the future
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    const y = futureDate.getFullYear();
    const m = String(futureDate.getMonth() + 1).padStart(2, "0");
    const d = String(futureDate.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${d}`;

    fireEvent.change(dateInput, { target: { value: dateStr } });

    await waitFor(() => {
      expect(screen.getByText(/Difficulty ramps to Final Mock/i)).toBeTruthy();
      expect(screen.getByText(/Final Mock Interview/i)).toBeTruthy();
    });

    // Clear button resets back to rolling mode
    const clearBtn = await screen.findByRole("button", { name: /Clear interview date/i });
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(screen.getByText(/Rolling 2-Week Plan/i)).toBeTruthy();
    });
  });

  it("changes cadence and updates plan sessions", async () => {
    const storage = new MemoryStorageAdapter();
    render(<ScheduleScreen storage={storage} />);

    await waitFor(() => {
      expect(screen.getByText("Interview Schedule & Prep Plan")).toBeTruthy();
    });

    const dailyRadio = screen.getByRole("radio", { name: /Daily Sprint/i });
    fireEvent.click(dailyRadio);

    await waitFor(() => {
      // Daily across 14 days = 14 sessions in generic plan
      expect(screen.getByText(/14 sessions/i)).toBeTruthy();
    });
  });

  it("triggers .ics calendar export and displays confirmation notice", async () => {
    const storage = new MemoryStorageAdapter();
    // Mock URL.createObjectURL and revokeObjectURL
    const createObjectURLMock = vi.fn(() => "blob:mock-ics-url");
    const revokeObjectURLMock = vi.fn();
    global.URL.createObjectURL = createObjectURLMock;
    global.URL.revokeObjectURL = revokeObjectURLMock;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<ScheduleScreen storage={storage} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Export \.ics Calendar/i })).toBeTruthy();
    });

    const exportBtn = screen.getByRole("button", { name: /Export \.ics Calendar/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(screen.getByText(/Calendar File Exported/i)).toBeTruthy();
      expect(createObjectURLMock).toHaveBeenCalled();
    });

    clickSpy.mockRestore();
  });

  it("shows OAuth fallback notice when Google Calendar is clicked without credentials", async () => {
    const storage = new MemoryStorageAdapter();
    render(<ScheduleScreen storage={storage} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Connect Google Calendar/i })).toBeTruthy();
    });

    const googleBtn = screen.getByRole("button", { name: /Connect Google Calendar/i });
    fireEvent.click(googleBtn);

    await waitFor(() => {
      expect(screen.getByText(/Google OAuth Unavailable/i)).toBeTruthy();
    });
  });

  it("persists schedule preferences in storage across reloads", async () => {
    const storage = new MemoryStorageAdapter();
    const { unmount } = render(<ScheduleScreen storage={storage} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Target Company (Optional)")).toBeTruthy();
    });

    const companyInput = screen.getByLabelText("Target Company (Optional)");
    fireEvent.change(companyInput, { target: { value: "Stripe" } });

    unmount();

    // Re-render screen with same storage
    render(<ScheduleScreen storage={storage} />);

    await waitFor(() => {
      const reloadedInput = screen.getByLabelText("Target Company (Optional)") as HTMLInputElement;
      expect(reloadedInput.value).toBe("Stripe");
    });
  });

  it("has zero accessibility violations with vitest-axe", async () => {
    const storage = new MemoryStorageAdapter();
    const { container } = render(
      <div data-theme="ink">
        <ScheduleScreen storage={storage} />
      </div>
    );

    await waitFor(() => {
      expect(screen.getByText("Interview Schedule & Prep Plan")).toBeTruthy();
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
