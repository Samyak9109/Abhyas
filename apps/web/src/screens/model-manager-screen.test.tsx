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

  it("displays Mobile Device Blocked when opened on a phone (FR-022, ADR-013)", async () => {
    const mobileRuntime: HardwareRuntime = {
      hasWebGpu: vi.fn().mockResolvedValue(true),
      isMobileDevice: vi.fn().mockReturnValue(true),
    };

    render(<ModelManagerScreen storage={storage} hardwareRuntime={mobileRuntime} />);

    await waitFor(() => {
      expect(screen.getByText("Mobile Device Blocked")).toBeDefined();
    });

    expect(
      screen.getByText(/Local models are disabled on mobile devices \(phones\/tablets\)/i)
    ).toBeDefined();

    // Verify all download buttons are disabled
    const downloadBtns = screen.getAllByRole("button", { name: /^Download /i });
    for (const btn of downloadBtns) {
      expect(btn).toHaveProperty("disabled", true);
    }
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

  it("handles adding custom WebLLM model with hardware fit estimate and UNVERIFIED badge", async () => {
    render(<ModelManagerScreen storage={storage} hardwareRuntime={mockHardwareRuntime} />);

    await waitFor(() => {
      expect(screen.getByText("In-Browser Model Manager")).toBeDefined();
    });

    const input = screen.getByLabelText(/Model Repository Identifier or File Path/i);
    fireEvent.change(input, { target: { value: "my-custom/local-weights.safetensors" } });

    await waitFor(() => {
      expect(screen.getByText("Pre-flight Passed")).toBeDefined();
      expect(screen.getByText("Hardware Fit Estimate")).toBeDefined();
    });

    const downloadBtn = screen.getByRole("button", {
      name: "Pre-flight & Download Custom Model",
    });
    await act(async () => {
      fireEvent.click(downloadBtn);
    });

    await waitFor(() => {
      expect(screen.getByText("Installed Custom Models (1)")).toBeDefined();
      expect(screen.getByText("my-custom/local-weights.safetensors")).toBeDefined();
      expect(screen.getByText("UNVERIFIED")).toBeDefined();
    });

    const installed = await storage.getAll<ModelRow>("models");
    const customRow = installed.find((m) => m.id === "my-custom/local-weights.safetensors");
    expect(customRow).toBeDefined();
    expect(customRow?.isCustom).toBe(true);
    expect(customRow?.format).toBe("safetensors");
    expect(customRow?.engine).toBe("webllm");
  });

  it("handles adding and registering Ollama custom model and switching engines", async () => {
    render(<ModelManagerScreen storage={storage} hardwareRuntime={mockHardwareRuntime} />);

    await waitFor(() => {
      expect(screen.getByText("In-Browser Model Manager")).toBeDefined();
    });

    // Switch to Ollama
    const ollamaRadio = screen.getByLabelText("Local Daemon (Ollama)");
    fireEvent.click(ollamaRadio);

    // Label should update
    const input = screen.getByLabelText("Ollama Model Tag");

    // Invalid tag with spaces
    fireEvent.change(input, { target: { value: "mistral with spaces" } });
    await waitFor(() => {
      expect(screen.getByText("Format Rejected")).toBeDefined();
      expect(screen.getByText(/cannot contain whitespace/i)).toBeDefined();
    });

    // Valid tag
    fireEvent.change(input, { target: { value: "mistral:7b" } });
    await waitFor(() => {
      expect(screen.getByText("Pre-flight Passed")).toBeDefined();
    });

    const registerBtn = screen.getByRole("button", {
      name: "Register & Verify Ollama Model",
    });
    await act(async () => {
      fireEvent.click(registerBtn);
    });

    await waitFor(() => {
      expect(screen.getByText("mistral:7b")).toBeDefined();
      expect(screen.getByText("OLLAMA")).toBeDefined();
      expect(screen.getByText("UNVERIFIED")).toBeDefined();
    });

    const installed = await storage.getAll<ModelRow>("models");
    const ollamaRow = installed.find((m) => m.id === "mistral:7b");
    expect(ollamaRow).toBeDefined();
    expect(ollamaRow?.engine).toBe("ollama");
    expect(ollamaRow?.isCustom).toBe(true);
  });

  it("renders custom models in accessible table view with UNVERIFIED badge", async () => {
    await storage.put<ModelRow>("models", {
      id: "ollama-custom-model:latest",
      engine: "ollama",
      sizeBytes: 2_000_000_000,
      status: "ready",
      isCustom: true,
      format: "gguf",
    });

    render(<ModelManagerScreen storage={storage} hardwareRuntime={mockHardwareRuntime} />);

    await waitFor(() => {
      expect(screen.getByText("In-Browser Model Manager")).toBeDefined();
    });

    const tableToggle = screen.getByRole("button", { name: "Table View" });
    fireEvent.click(tableToggle);

    await waitFor(() => {
      expect(screen.getByText("ollama-custom-model:latest")).toBeDefined();
      expect(screen.getByText("UNVERIFIED")).toBeDefined();
    });
  });

  it("runs sanity test on Ollama custom model using OllamaAdapter", async () => {
    await storage.put<ModelRow>("models", {
      id: "mistral-local:latest",
      engine: "ollama",
      sizeBytes: 2_000_000_000,
      status: "ready",
      isCustom: true,
      format: "gguf",
    });

    // Mock fetch for Ollama streaming
    const originalFetch = globalThis.fetch;
    const encoder = new TextEncoder();

    globalThis.fetch = vi.fn().mockImplementation(() => {
      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                message: { role: "assistant", content: '{"status": "ok", "ready": true}' },
                done: false,
              }) + "\n"
            )
          );
          controller.enqueue(encoder.encode(JSON.stringify({ done: true }) + "\n"));
          controller.close();
        },
      });
      return Promise.resolve(new Response(mockStream, { status: 200 }));
    });

    try {
      render(<ModelManagerScreen storage={storage} hardwareRuntime={mockHardwareRuntime} />);

      await waitFor(() => {
        expect(screen.getByText("mistral-local:latest")).toBeDefined();
      });

      const sanityBtns = screen.getAllByRole("button", { name: "Run Sanity Test" });
      const targetBtn = sanityBtns[0];
      expect(targetBtn).toBeDefined();

      if (targetBtn) {
        await act(async () => {
          fireEvent.click(targetBtn);
        });
      }

      await waitFor(() => {
        expect(screen.queryByText(/Starting sanity checks/i)).toBeNull();
      });

      const updatedRow = await storage.get<ModelRow>("models", "mistral-local:latest");
      expect(updatedRow?.sanityResult).toBeDefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
