// FR-025, ADR-008, PG-20: Tests for CompanyDirectoryScreen.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { MemoryStorageAdapter } from "@abhyas/core";
import { CompanyDirectoryScreen } from "./CompanyDirectoryScreen";

describe("PG-20: CompanyDirectoryScreen (M4.3)", () => {
  it("renders the directory with all 12 seed company packs and selects default company", async () => {
    const storage = new MemoryStorageAdapter();
    render(<CompanyDirectoryScreen storage={storage} />);

    expect(screen.getByText(/Company Directory/i)).toBeTruthy();
    expect(screen.getByText(/Browse vetted company packs/i)).toBeTruthy();

    // Check presence of seed companies
    expect(screen.getByText("Google")).toBeTruthy();
    expect(screen.getByText("Amazon")).toBeTruthy();
    expect(screen.getByText("Microsoft")).toBeTruthy();
    expect(screen.getByText("Meta")).toBeTruthy();
    expect(screen.getByText("Apple")).toBeTruthy();
    expect(screen.getByText("Netflix")).toBeTruthy();
    expect(screen.getByText("Stripe")).toBeTruthy();
    expect(screen.getByText("Uber")).toBeTruthy();
    expect(screen.getByText("Airbnb")).toBeTruthy();
    expect(screen.getByText("Spotify")).toBeTruthy();
    expect(screen.getByText("GitHub")).toBeTruthy();
    expect(screen.getByText("Salesforce")).toBeTruthy();

    // Default selected company (Google) details should be loaded
    await waitFor(() => {
      expect(screen.getByTestId("company-context-panel")).toBeTruthy();
      expect(screen.getByText("Documented Tech Stack")).toBeTruthy();
      expect(screen.getByText("Core Values & Principles")).toBeTruthy();
    });
  });

  it("filters companies by search query", async () => {
    const storage = new MemoryStorageAdapter();
    render(<CompanyDirectoryScreen storage={storage} />);

    const searchInput = screen.getByPlaceholderText(/Search company name, domain/i);
    fireEvent.change(searchInput, { target: { value: "stripe" } });

    await waitFor(() => {
      expect(screen.getByText("Stripe")).toBeTruthy();
      expect(screen.queryByText("Amazon")).toBeNull();
      expect(screen.queryByText("Google")).toBeNull();
    });
  });

  it("filters companies by coverage level", async () => {
    const storage = new MemoryStorageAdapter();
    render(<CompanyDirectoryScreen storage={storage} />);

    // Click "High coverage" pill
    const highPill = screen.getByRole("button", { name: /High coverage/i });
    fireEvent.click(highPill);

    await waitFor(() => {
      expect(screen.getByText("Google")).toBeTruthy();
      expect(screen.getByText("Amazon")).toBeTruthy();
    });

    // Click "Medium coverage" pill
    const mediumPill = screen.getByRole("button", { name: /Medium coverage/i });
    fireEvent.click(mediumPill);

    await waitFor(() => {
      expect(screen.getByText("No companies found")).toBeTruthy();
      expect(screen.queryByText("Google")).toBeNull();
    });

    // Clicking "All" restores all companies
    const allPill = screen.getByRole("button", { name: /All/i });
    fireEvent.click(allPill);

    await waitFor(() => {
      expect(screen.getAllByText("Google").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Amazon")).toBeTruthy();
    });
  });

  it("switches selected company and displays its evidenced details and sources", async () => {
    const storage = new MemoryStorageAdapter();
    render(<CompanyDirectoryScreen storage={storage} />);

    // Click on Amazon from the list
    const amazonItem = screen.getByText("Amazon");
    fireEvent.click(amazonItem);

    await waitFor(() => {
      expect(screen.getByText("amazon.com")).toBeTruthy();
      expect(screen.getByText(/Customer Obsession/i)).toBeTruthy();
      expect(screen.getByText(/Invent and Simplify/i)).toBeTruthy();
    });
  });

  it("triggers onSelectCompanyForSession and onNavigateSessionSetup when 'Practice for this company' is clicked", async () => {
    const storage = new MemoryStorageAdapter();
    const onSelect = vi.fn();
    const onNavigate = vi.fn();

    render(
      <CompanyDirectoryScreen
        storage={storage}
        initialCompanySlug="stripe"
        onSelectCompanyForSession={onSelect}
        onNavigateSessionSetup={onNavigate}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Stripe")).toBeTruthy();
    });

    const practiceBtn = await screen.findByRole("button", {
      name: /Practice for Stripe/i,
    });
    fireEvent.click(practiceBtn);

    expect(onSelect).toHaveBeenCalledWith("stripe");
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("opens the request dialog when '+ Request a company' is clicked", async () => {
    const storage = new MemoryStorageAdapter();
    render(<CompanyDirectoryScreen storage={storage} />);

    const reqBtn = screen.getByTestId("request-company-header-btn");
    fireEvent.click(reqBtn);

    expect(screen.getByText(/Request a Company Pack/i)).toBeTruthy();
  });

  it("opens the request dialog from zero search results state", async () => {
    const storage = new MemoryStorageAdapter();
    render(<CompanyDirectoryScreen storage={storage} />);

    const searchInput = screen.getByPlaceholderText(/Search company name, domain/i);
    fireEvent.change(searchInput, { target: { value: "nonexistentcorpxyz" } });

    await waitFor(() => {
      expect(screen.getByText(/No companies found/i)).toBeTruthy();
    });

    const zeroReqBtn = screen.getByTestId("request-company-zero-state-btn");
    fireEvent.click(zeroReqBtn);

    expect(screen.getByText(/Request a Company Pack/i)).toBeTruthy();
  });

  it("opens the report dialog when 'Report incorrect data' is clicked in company panel", async () => {
    const storage = new MemoryStorageAdapter();
    render(<CompanyDirectoryScreen storage={storage} initialCompanySlug="google" />);

    await waitFor(() => {
      expect(screen.getByTestId("company-context-panel")).toBeTruthy();
    });

    const reportBtn = screen.getByTestId("open-report-dialog-btn");
    fireEvent.click(reportBtn);

    expect(screen.getByText(/Report Incorrect Company Data/i)).toBeTruthy();
    expect(screen.getByText(/Target Pack:/i)).toBeTruthy();
    expect(screen.getAllByText("Google").length).toBeGreaterThanOrEqual(1);
  });

  it("displays 'REQUESTED ✓' without demand counts when a company is requested (M5.4, FR-026)", async () => {
    const storage = new MemoryStorageAdapter();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          slug: "datadog",
          name: "Datadog",
          domain: "datadoghq.com",
          aliases: [],
          status: "requested",
          coverage: null,
          last_researched_at: null,
        },
      ],
    } as Response);

    render(
      <CompanyDirectoryScreen
        storage={storage}
        initialCompanySlug="datadog"
        apiUrl="http://api.test"
      />
    );

    await waitFor(() => {
      const badge = screen.getByTestId("company-status-requested");
      expect(badge).toBeTruthy();
      expect(badge.textContent).toBe("REQUESTED ✓");
      // Must not display demand numbers / counts to users (M5.4 acceptance criteria)
      expect(badge.textContent).not.toMatch(/\d+/);
    });

    // Detail panel explains research pending state without showing demand counts
    await waitFor(() => {
      expect(screen.getByTestId("company-status-detail-panel")).toBeTruthy();
      expect(screen.getByText(/Research for Datadog has been requested/i)).toBeTruthy();
    });
  });

  describe("Accessibility (axe)", () => {
    it("has zero axe violations under Ink and Paper themes", async () => {
      const storage = new MemoryStorageAdapter();

      // Ink theme
      const inkRender = render(
        <div data-theme="ink">
          <CompanyDirectoryScreen storage={storage} />
        </div>
      );
      await screen.findByText(/Company Directory/i);
      await screen.findByTestId("company-context-panel");
      const inkResults = await axe(inkRender.container);
      expect(inkResults.violations).toEqual([]);
      inkRender.unmount();

      // Paper theme
      const paperRender = render(
        <div data-theme="paper">
          <CompanyDirectoryScreen storage={storage} />
        </div>
      );
      await screen.findByText(/Company Directory/i);
      await screen.findByTestId("company-context-panel");
      const paperResults = await axe(paperRender.container);
      expect(paperResults.violations).toEqual([]);
      paperRender.unmount();
    });
  });
});
