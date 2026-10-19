// FR-026, FR-029, PG-21: Tests for CompanyReportDialog component.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { axe } from "vitest-axe";
import { CompanyReportDialog } from "./CompanyReportDialog";

describe("PG-21: CompanyReportDialog (M4.5)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const testCompany = {
    name: "Stripe",
    slug: "stripe",
    domain: "stripe.com",
  };

  it("does not render when isOpen is false", () => {
    render(<CompanyReportDialog isOpen={false} onClose={() => {}} company={testCompany} />);
    expect(screen.queryByTestId("company-report-dialog")).toBeNull();
  });

  it("renders in report mode with prefilled company and field options", () => {
    render(<CompanyReportDialog isOpen={true} onClose={() => {}} company={testCompany} />);

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/Report Incorrect Company Data/i)).toBeTruthy();
    expect(screen.getByText("Stripe")).toBeTruthy();
    expect(screen.getByLabelText(/Affected Field/i)).toBeTruthy();
    expect(screen.getByLabelText(/Inaccuracy Details/i)).toBeTruthy();
    expect(screen.getByText(/Privacy Assurance/i)).toBeTruthy();
  });

  it("validates reason length and shows error if too short", async () => {
    render(<CompanyReportDialog isOpen={true} onClose={() => {}} company={testCompany} />);

    const submitBtn = screen.getByTestId("open-report-issue-btn");
    fireEvent.click(submitBtn);

    expect(screen.getByText(/Please describe the issue in at least 10 characters/i)).toBeTruthy();
  });

  it("opens prefilled GitHub issue URL when report is valid", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<CompanyReportDialog isOpen={true} onClose={() => {}} company={testCompany} />);

    const textarea = screen.getByLabelText(/Inaccuracy Details/i);
    fireEvent.change(textarea, {
      target: {
        value: "The documented tech stack lists Ruby, but Stripe also heavily uses Sorbet and Go.",
      },
    });

    const submitBtn = screen.getByTestId("open-report-issue-btn");
    fireEvent.click(submitBtn);

    expect(openSpy).toHaveBeenCalledTimes(1);
    const calledUrl = openSpy.mock.calls[0]![0] as string;
    expect(calledUrl).toContain("https://github.com/abhyas/abhyas/issues/new");
    expect(calledUrl).toContain("template=company_pack_report.md");
    expect(calledUrl).toContain(encodeURIComponent("[Company Pack Report] Stripe"));
    expect(calledUrl).toContain(encodeURIComponent("The documented tech stack lists Ruby"));

    // Confirmation callout appears
    expect(screen.getByText(/GitHub issue link opened/i)).toBeTruthy();
  });

  it("copies report markdown to clipboard", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    render(<CompanyReportDialog isOpen={true} onClose={() => {}} company={testCompany} />);

    const textarea = screen.getByLabelText(/Inaccuracy Details/i);
    fireEvent.change(textarea, {
      target: {
        value: "The interview process stages are missing the practical pair-programming stage.",
      },
    });

    const copyBtn = screen.getByTestId("copy-report-btn");
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledTimes(1);
      const copiedText = writeTextMock.mock.calls[0]![0] as string;
      expect(copiedText).toContain("Company Pack Inaccuracy Report");
      expect(copiedText).toContain("Stripe");
      expect(copiedText).toContain("The interview process stages are missing");
      expect(screen.getByText("Copied ✓")).toBeTruthy();
    });
  });

  it("switches to request mode and validates company name", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<CompanyReportDialog isOpen={true} onClose={() => {}} initialMode="request" />);

    expect(screen.getByText(/Request a Company Pack/i)).toBeTruthy();
    expect(screen.getByLabelText(/Company Name/i)).toBeTruthy();

    // Submit with empty name
    const submitBtn = screen.getByTestId("open-request-issue-btn");
    fireEvent.click(submitBtn);

    expect(screen.getByText(/Please provide a company name/i)).toBeTruthy();

    // Fill valid name and domain
    const nameInput = screen.getByLabelText(/Company Name/i);
    fireEvent.change(nameInput, { target: { value: "Datadog" } });

    const domainInput = screen.getByLabelText(/Website or Careers Page/i);
    fireEvent.change(domainInput, { target: { value: "https://www.datadoghq.com" } });

    fireEvent.click(submitBtn);

    expect(openSpy).toHaveBeenCalledTimes(1);
    const calledUrl = openSpy.mock.calls[0]![0] as string;
    expect(calledUrl).toContain("template=company_pack_request.md");
    expect(calledUrl).toContain(encodeURIComponent("[Company Request] Datadog"));
    expect(calledUrl).toContain(encodeURIComponent("https://www.datadoghq.com"));
  });

  it("copies request markdown to clipboard", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    render(<CompanyReportDialog isOpen={true} onClose={() => {}} initialMode="request" />);

    const nameInput = screen.getByLabelText(/Company Name/i);
    fireEvent.change(nameInput, { target: { value: "Figma" } });

    const copyBtn = screen.getByTestId("copy-request-btn");
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledTimes(1);
      const copiedText = writeTextMock.mock.calls[0]![0] as string;
      expect(copiedText).toContain("Company Pack Research Request");
      expect(copiedText).toContain("Figma");
      expect(screen.getByText("Copied ✓")).toBeTruthy();
    });
  });

  it("closes dialog when Escape key is pressed", () => {
    const onCloseMock = vi.fn();
    render(<CompanyReportDialog isOpen={true} onClose={onCloseMock} company={testCompany} />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it("submits research demand via API and displays 'Requested ✓' without demand counts (M5.4)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "requested",
        slug: "snowflake",
        message: "Demand registered",
      }),
    } as Response);

    render(
      <CompanyReportDialog
        isOpen={true}
        onClose={() => {}}
        initialMode="request"
        apiUrl="http://api.test"
      />
    );

    const nameInput = screen.getByLabelText(/Company Name/i);
    fireEvent.change(nameInput, { target: { value: "Snowflake" } });

    const submitBtn = screen.getByTestId("submit-request-api-btn");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId("request-success-panel")).toBeTruthy();
      const calloutTitle = screen.getByText("Requested ✓");
      expect(calloutTitle).toBeTruthy();
      // Verifies zero demand counts are shown to the candidate
      const successText = screen.getByTestId("request-success-panel").textContent || "";
      expect(successText).not.toMatch(/\d+ users|\d+ requests/);
    });
  });

  it("submits inaccuracy report via API and displays confirmation (M5.4)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 99, status: "received" }),
    } as Response);

    render(
      <CompanyReportDialog
        isOpen={true}
        onClose={() => {}}
        initialMode="report"
        company={testCompany}
        apiUrl="http://api.test"
      />
    );

    const textarea = screen.getByLabelText(/Inaccuracy Details/i);
    fireEvent.change(textarea, {
      target: {
        value: "The documented tech stack is missing Kafka and Sorbet typing.",
      },
    });

    const submitBtn = screen.getByTestId("submit-report-api-btn");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId("report-success-panel")).toBeTruthy();
      expect(screen.getByText("Report Submitted ✓")).toBeTruthy();
    });
  });

  it("falls back to GitHub issue instructions when API is unreachable (M5.4)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Connection refused"));

    render(
      <CompanyReportDialog
        isOpen={true}
        onClose={() => {}}
        initialMode="request"
        apiUrl="http://api.test"
      />
    );

    const nameInput = screen.getByLabelText(/Company Name/i);
    fireEvent.change(nameInput, { target: { value: "Notion" } });

    const submitBtn = screen.getByTestId("submit-request-api-btn");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Offline \/ GitHub Issue Fallback/i)).toBeTruthy();
      expect(screen.getByTestId("open-request-issue-btn")).toBeTruthy();
    });
  });

  it("passes automated accessibility checks (WCAG 2.2 AA in Ink and Paper themes)", async () => {
    // Ink theme
    document.documentElement.setAttribute("data-theme", "ink");
    const { container, rerender } = render(
      <CompanyReportDialog isOpen={true} onClose={() => {}} company={testCompany} />
    );
    let results = await axe(container);
    expect(results).toHaveNoViolations();

    // Paper theme
    document.documentElement.setAttribute("data-theme", "paper");
    rerender(<CompanyReportDialog isOpen={true} onClose={() => {}} initialMode="request" />);
    results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
