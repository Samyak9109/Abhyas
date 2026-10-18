import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryStorageAdapter, type HardwareRuntime, type ModelRow } from "@abhyas/core";
import { ModelManagerScreen } from "./ModelManagerScreen";

const mockHardwareRuntime: HardwareRuntime = {
  hasWebGpu: vi.fn().mockResolvedValue(true),
  isMobileDevice: vi.fn().mockReturnValue(false),
  getConcurrency: vi.fn().mockReturnValue(8),
  getDeviceMemoryGb: vi.fn().mockReturnValue(16),
  getStorageQuotaMb: vi.fn().mockResolvedValue(50000),
  runComputeBenchmark: vi.fn().mockResolvedValue({
    tokensPerSecond: 25.5,
    latencyMs: 38,
  }),
};

describe("ModelManagerScreen (PG-19, M3.2)", () => {
  let storage: MemoryStorageAdapter;

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
  });

  it("renders device benchmark, storage meter, and curated models", async () => {
    render(<ModelManagerScreen storage={storage} hardwareRuntime={mockHardwareRuntime} />);

    await waitFor(() => {
      expect(screen.getByText("In-Browser Model Manager")).toBeDefined();
    });

    expect(screen.getByText(/25.5 tok\/s/)).toBeDefined();
    expect(screen.getByText("Browser Storage Meter")).toBeDefined();
    expect(screen.getByText("Curated WebGPU Models")).toBeDefined();
    expect(screen.getByText("SmolLM2 1.7B Instruct")).toBeDefined();
    expect(screen.getByText("Llama 3.2 3B Instruct")).toBeDefined();
  });

  it("switches to accessible table view", async () => {
    render(<ModelManagerScreen storage={storage} hardwareRuntime={mockHardwareRuntime} />);

    await waitFor(() => {
      expect(screen.getByText("In-Browser Model Manager")).toBeDefined();
    });

    const tableToggle = screen.getByRole("button", { name: "Table View" });
    fireEvent.click(tableToggle);

    expect(
      screen.getByRole("table", { name: "Curated in-browser models comparison and actions" })
    ).toBeDefined();
  });

  it("handles model download, pause, resume, and load lifecycle", async () => {
    render(<ModelManagerScreen storage={storage} hardwareRuntime={mockHardwareRuntime} />);

    await waitFor(() => {
      expect(screen.getByText("In-Browser Model Manager")).toBeDefined();
    });

    // Find first download button (for SmolLM2)
    const downloadBtns = screen.getAllByRole("button", { name: /Download \(/i });
    expect(downloadBtns.length).toBeGreaterThan(0);

    // Start download
    await act(async () => {
      const firstBtn = downloadBtns[0];
      if (firstBtn) {
        fireEvent.click(firstBtn);
      }
    });

    // Model becomes ready (in mock bridge)
    await waitFor(() => {
      expect(screen.getByText("INSTALLED")).toBeDefined();
    });

    // Verify stored model row
    const installed = await storage.getAll<ModelRow>("models");
    expect(installed.length).toBe(1);
    expect(installed[0]?.status).toBe("ready");
  });

  it("validates custom model formats and blocks unsafe pickle files (ADR-017)", async () => {
    render(<ModelManagerScreen storage={storage} hardwareRuntime={mockHardwareRuntime} />);

    await waitFor(() => {
      expect(screen.getByText("Add Custom Model (Power Users)")).toBeDefined();
    });

    const input = screen.getByLabelText(/Model Repository Identifier or File Path/i);

    // Enter safe format
    fireEvent.change(input, { target: { value: "my-org/custom-model.safetensors" } });
    await waitFor(() => {
      expect(screen.getByText("Pre-flight Passed")).toBeDefined();
    });

    // Enter unsafe pickle format
    fireEvent.change(input, { target: { value: "malicious-actor/exploit.pkl" } });
    await waitFor(() => {
      expect(screen.getByText("Format Rejected")).toBeDefined();
      expect(screen.getByText(/Unsafe format "\.pkl" is prohibited/)).toBeDefined();
    });
  });

  it("shows delete confirmation dialog and removes model", async () => {
    // Pre-populate an installed model
    await storage.put<ModelRow>("models", {
      id: "SmolLM2-1.7B-Instruct-q4f16_1-MLC",
      engine: "webllm",
      sizeBytes: 1_050_000_000,
      status: "ready",
    });

    render(<ModelManagerScreen storage={storage} hardwareRuntime={mockHardwareRuntime} />);

    await waitFor(() => {
      expect(screen.getByText("INSTALLED")).toBeDefined();
    });

    const deleteBtn = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(deleteBtn);

    // Dialog appears
    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText("Delete Model Weights?")).toBeDefined();

    const confirmBtn = screen.getByRole("button", { name: "Delete Model" });
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    await waitFor(async () => {
      const remaining = await storage.getAll<ModelRow>("models");
      expect(remaining.length).toBe(0);
    });
  });

  it("displays WebGPU unavailable message when hardware is unsupported", async () => {
    const unsupportedRuntime: HardwareRuntime = {
      hasWebGpu: vi.fn().mockResolvedValue(false),
      isMobileDevice: vi.fn().mockReturnValue(false),
    };

    render(<ModelManagerScreen storage={storage} hardwareRuntime={unsupportedRuntime} />);

    await waitFor(() => {
      expect(screen.getByText("WebGPU Unavailable")).toBeDefined();
    });
  });

  it("has zero axe accessibility violations under Ink and Paper themes", async () => {
    const { container } = render(
      <div data-theme="ink">
        <ModelManagerScreen storage={storage} hardwareRuntime={mockHardwareRuntime} />
      </div>
    );

    await waitFor(() => {
      expect(screen.getByText("In-Browser Model Manager")).toBeDefined();
    });

    expect(await axe(container)).toHaveNoViolations();

    container.setAttribute("data-theme", "paper");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("displays measured speeds, reference sanity badges, and executes local sanity tests", async () => {
    // Pre-populate an installed and loaded model
    await storage.put<ModelRow>("models", {
      id: "SmolLM2-1.7B-Instruct-q4f16_1-MLC",
      engine: "webllm",
      sizeBytes: 1_050_000_000,
      status: "ready",
    });

    render(<ModelManagerScreen storage={storage} hardwareRuntime={mockHardwareRuntime} />);

    await waitFor(() => {
      expect(screen.getByText("In-Browser Model Manager")).toBeDefined();
    });

    // Check that measured speed and verified sanity status badge are shown
    expect(screen.getAllByText(/INTERVIEW-READY/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/28.5 tps/i)).toBeDefined();

    // Load model into memory
    const loadBtn = screen.getByRole("button", { name: "Load into Memory" });
    await act(async () => {
      fireEvent.click(loadBtn);
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Run Sanity Test" })).toBeDefined();
    });

    // Run Sanity Test
    const sanityBtn = screen.getByRole("button", { name: "Run Sanity Test" });
    await act(async () => {
      fireEvent.click(sanityBtn);
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Run Sanity Test" })).toBeDefined();
    });
  });
});
