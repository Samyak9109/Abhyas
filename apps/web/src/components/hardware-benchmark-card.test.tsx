// FR-024, FR-022, ADR-013: Tests for HardwareBenchmarkCard component.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import type { HardwareRuntime } from "@abhyas/core";
import { HardwareBenchmarkCard } from "./HardwareBenchmarkCard";

describe("HardwareBenchmarkCard (FR-024, M3.1)", () => {
  it("renders mobile device restriction callout when accessed from a phone or tablet", async () => {
    const mockMobileRuntime: HardwareRuntime = {
      hasWebGpu: () => true,
      isMobileDevice: () => true,
    };

    render(<HardwareBenchmarkCard runtime={mockMobileRuntime} />);

    await waitFor(() => {
      expect(screen.getByText("Mobile device detected")).toBeDefined();
    });

    expect(screen.getByText(/Local models are disabled on mobile devices/i)).toBeDefined();
  });

  it("renders WebGPU unavailable callout when browser lacks WebGPU", async () => {
    const mockNoGpuRuntime: HardwareRuntime = {
      hasWebGpu: () => false,
      isMobileDevice: () => false,
    };

    render(<HardwareBenchmarkCard runtime={mockNoGpuRuntime} />);

    await waitFor(() => {
      expect(screen.getByText("WebGPU unavailable")).toBeDefined();
    });

    expect(
      screen.getByText(/WebGPU is not supported or not enabled in your browser/i)
    ).toBeDefined();
  });

  it("renders supported hardware specs and dynamically runs benchmark for standard tier", async () => {
    const mockStandardRuntime: HardwareRuntime = {
      hasWebGpu: () => true,
      isMobileDevice: () => false,
      getAdapterInfo: async () => ({
        vendor: "Apple",
        description: "Apple M2 Max",
      }),
      getConcurrency: () => 12,
      getDeviceMemoryGb: () => 32,
      getStorageQuotaMb: async () => 64000,
      runComputeBenchmark: async () => ({
        tokensPerSecond: 26.4,
        latencyMs: 95,
      }),
    };

    const onBenchmarkComplete = vi.fn();

    render(
      <HardwareBenchmarkCard
        runtime={mockStandardRuntime}
        onBenchmarkComplete={onBenchmarkComplete}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("✓ WebGPU Available")).toBeDefined();
    });

    expect(screen.getByText("Apple M2 Max")).toBeDefined();
    expect(screen.getByText("12 cores")).toBeDefined();
    expect(screen.getByText("~32 GB")).toBeDefined();

    // Click run speed test
    const benchButton = screen.getByRole("button", { name: "Run Speed Benchmark" });
    fireEvent.click(benchButton);

    await waitFor(() => {
      expect(screen.getByText("26.4")).toBeDefined();
    });

    expect(screen.getByText("Standard (3B models)")).toBeDefined();
    expect(screen.getByText("Llama-3.2-3B-Instruct-q4f16_1-MLC")).toBeDefined();
    expect(onBenchmarkComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        tier: "standard",
        tokensPerSecond: 26.4,
      })
    );
  });

  it("dynamically recommends basic tier for slower runtimes", async () => {
    const mockSlowRuntime: HardwareRuntime = {
      hasWebGpu: () => true,
      isMobileDevice: () => false,
      runComputeBenchmark: async () => ({
        tokensPerSecond: 10.5,
        latencyMs: 210,
      }),
    };

    render(<HardwareBenchmarkCard runtime={mockSlowRuntime} autoRunBenchmark />);

    await waitFor(() => {
      expect(screen.getByText("10.5")).toBeDefined();
    });

    expect(screen.getByText("Basic (0.5B - 1.5B models)")).toBeDefined();
    expect(screen.getByText("SmolLM2-1.7B-Instruct-q4f16_1-MLC")).toBeDefined();
  });

  it("dynamically recommends advanced tier for high-throughput runtimes", async () => {
    const mockFastRuntime: HardwareRuntime = {
      hasWebGpu: () => true,
      isMobileDevice: () => false,
      runComputeBenchmark: async () => ({
        tokensPerSecond: 45.0,
        latencyMs: 65,
      }),
    };

    render(<HardwareBenchmarkCard runtime={mockFastRuntime} autoRunBenchmark />);

    await waitFor(() => {
      expect(screen.getByText("45")).toBeDefined();
    });

    expect(screen.getByText("Advanced (7B - 8B models)")).toBeDefined();
    expect(screen.getByText("Llama-3.1-8B-Instruct-q4f16_1-MLC")).toBeDefined();
  });

  it("has zero axe accessibility violations under Ink and Paper themes", async () => {
    const mockRuntime: HardwareRuntime = {
      hasWebGpu: () => true,
      isMobileDevice: () => false,
      getAdapterInfo: async () => ({ vendor: "AMD", description: "Radeon RX 7900" }),
      runComputeBenchmark: async () => ({ tokensPerSecond: 32, latencyMs: 80 }),
    };

    const { container } = render(<HardwareBenchmarkCard runtime={mockRuntime} autoRunBenchmark />);

    await waitFor(() => {
      expect(screen.getByText("32")).toBeDefined();
    });

    // Theme: Ink (dark)
    document.documentElement.setAttribute("data-theme", "ink");
    const inkAxe = await axe(container);
    expect(inkAxe.violations).toEqual([]);

    // Theme: Paper (light)
    document.documentElement.setAttribute("data-theme", "paper");
    const paperAxe = await axe(container);
    expect(paperAxe.violations).toEqual([]);
  });
});
