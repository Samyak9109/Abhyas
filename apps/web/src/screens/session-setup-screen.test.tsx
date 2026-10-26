// FR-006, PG-11: Tests for Session Setup screen (M1.4).
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import {
  MemoryStorageAdapter,
  SessionPlanSchema,
  type ProfileRow,
  type ProviderRow,
} from "@abhyas/core";
import { getSeedCompanyPack } from "@abhyas/content";
import { SessionSetupScreen } from "./SessionSetupScreen";

describe("M1.4: SessionSetupScreen (PG-11)", () => {
  it("renders with 5 interview types, lengths, styles, and gated voice mode", async () => {
    const storage = new MemoryStorageAdapter();
    const onStart = vi.fn();
    const onBack = vi.fn();

    render(<SessionSetupScreen storage={storage} onStart={onStart} onBack={onBack} />);

    // Header & Stepper
    expect(screen.getByText("Abhyas")).toBeTruthy();
    expect(screen.getByRole("link", { name: /abhyas home/i })).toBeTruthy();
    expect(screen.getByText("Step 3 of 3")).toBeTruthy();
    expect(await screen.findByText("Set Up Your Session")).toBeTruthy();

    // 5 Interview Types (FR-006)
    expect(screen.getByText("HR / Behavioral")).toBeTruthy();
    expect(screen.getByText("Technical")).toBeTruthy();
    expect(screen.getByText("System Design")).toBeTruthy();
    expect(screen.getByText("DSA Verbal")).toBeTruthy();
    expect(screen.getByText("Mixed")).toBeTruthy();

    // Session Lengths
    expect(screen.getByText("5 questions")).toBeTruthy();
    expect(screen.getByText("10 questions")).toBeTruthy();
    expect(screen.getByText("15 questions")).toBeTruthy();

    // Interviewer Styles
    expect(screen.getByText("Friendly")).toBeTruthy();
    expect(screen.getByText("Standard")).toBeTruthy();
    expect(screen.getByText("Strict")).toBeTruthy();

    // Input Mode: Voice is un-gated but unsupported in jsdom without mock
    expect(screen.getByText("Text")).toBeTruthy();
    expect(screen.getByText("Voice")).toBeTruthy();
    expect(screen.getByText(/Voice input requires Chrome, Edge, or Safari/i)).toBeTruthy();
  });

  it("loads profile level and displays calibrated difficulty notice", async () => {
    const storage = new MemoryStorageAdapter();
    const profile: ProfileRow = {
      id: "current_profile",
      level: "staff_plus",
      targetRole: "Staff Systems Architect",
      updatedAt: new Date().toISOString(),
    };
    await storage.put("profile", profile);

    render(<SessionSetupScreen storage={storage} onStart={vi.fn()} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Difficulty 4–5 \(expert\)/i)).toBeTruthy();
      expect(screen.getByText("Staff Systems Architect")).toBeTruthy();
    });
  });

  it("warns and disables Start Session when no provider is configured", async () => {
    const storage = new MemoryStorageAdapter();
    const onNavigateAISetup = vi.fn();

    render(
      <SessionSetupScreen
        storage={storage}
        onStart={vi.fn()}
        onBack={vi.fn()}
        onNavigateAISetup={onNavigateAISetup}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("AI provider not configured")).toBeTruthy();
    });

    const startBtn = screen.getByRole("button", { name: /Start Session/i });
    expect(startBtn).toHaveProperty("disabled", true);

    const link = screen.getByRole("button", { name: /Go to AI Setup/i });
    fireEvent.click(link);
    expect(onNavigateAISetup).toHaveBeenCalledTimes(1);
  });

  it("creates a validated SessionPlan and triggers onStart when provider is configured", async () => {
    const storage = new MemoryStorageAdapter();
    const provider: ProviderRow = {
      id: "provider_1",
      kind: "gemini",
      modelRoles: {
        interviewer: "gemini-2.0-flash",
        evaluator: "gemini-2.0-flash",
      },
      key: "dummy-key",
    };
    await storage.put("providers", provider);

    const onStart = vi.fn();
    render(<SessionSetupScreen storage={storage} onStart={onStart} onBack={vi.fn()} />);

    // Wait for provider to load and enable start
    await waitFor(() => {
      const startBtn = screen.getByRole("button", { name: /Start Session/i });
      expect(startBtn).toHaveProperty("disabled", false);
    });

    // Change interview type to system design
    fireEvent.click(screen.getByText("System Design"));

    // Change length to 5
    fireEvent.click(screen.getByText("5 questions"));

    // Change style to strict
    fireEvent.click(screen.getByText("Strict"));

    // Start session
    fireEvent.click(screen.getByRole("button", { name: /Start Session/i }));

    await waitFor(() => {
      expect(onStart).toHaveBeenCalledTimes(1);
    });

    const plan = onStart.mock.calls[0]?.[0];
    expect(plan).toBeDefined();

    // Verify against SessionPlanSchema
    const parsed = SessionPlanSchema.safeParse(plan);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.type).toBe("system_design");
      expect(parsed.data.length).toBe(5);
      expect(parsed.data.style).toBe("strict");
      expect(parsed.data.inputMode).toBe("text");
      expect(parsed.data.sessionId).toBeTruthy();
    }
  });

  it("calls onBack when Back to Profile button is clicked", async () => {
    const storage = new MemoryStorageAdapter();
    const onBack = vi.fn();

    render(<SessionSetupScreen storage={storage} onStart={vi.fn()} onBack={onBack} />);
    await screen.findByText("Set Up Your Session");

    fireEvent.click(screen.getByRole("button", { name: /Back to Profile/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("allows selecting Voice mode when speech input is supported and creates voice plan", async () => {
    const storage = new MemoryStorageAdapter();
    const { MockSpeechInput } = await import("@abhyas/core");
    const mockSpeech = new MockSpeechInput({ isSupported: true });

    const provider: ProviderRow = {
      id: "prov-1",
      kind: "gemini",
      modelRoles: {
        interviewer: "gemini-2.5-flash",
        evaluator: "gemini-2.5-flash",
      },
      key: "dummy-key",
    };
    await storage.put("providers", provider);

    const onStart = vi.fn();
    render(
      <SessionSetupScreen
        storage={storage}
        speechInput={mockSpeech}
        onStart={onStart}
        onBack={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Start Session/i })).toHaveProperty(
        "disabled",
        false
      );
    });

    // Voice card is active and not disabled
    const voiceCard = screen.getByText("Voice");
    fireEvent.click(voiceCard);

    // Start session
    fireEvent.click(screen.getByRole("button", { name: /Start Session/i }));

    await waitFor(() => {
      expect(onStart).toHaveBeenCalledTimes(1);
    });

    const plan = onStart.mock.calls[0]?.[0];
    expect(plan.inputMode).toBe("voice");
  });

  describe("Device Rules Enforcement (M3.5, FR-022, ADR-013)", () => {
    it("enforces text-only mode for local model (webllm) on PC and disables voice input", async () => {
      const storage = new MemoryStorageAdapter();
      await storage.put("providers", {
        id: "webllm",
        kind: "webllm",
        modelRoles: { interviewer: "SmolLM2-1.7B-Instruct-q4f16_1-MLC" },
      });
      await storage.put("settings", {
        key: "activeProviderId",
        value: "webllm",
      });

      const onStart = vi.fn();
      const mockSpeechInput = {
        isSupported: true,
        getState: () => "idle" as const,
        start: vi.fn(),
        stop: vi.fn().mockResolvedValue(""),
        abort: vi.fn(),
      };

      const desktopRuntime = {
        hasWebGpu: () => true,
        isMobileDevice: () => false,
      };

      render(
        <SessionSetupScreen
          storage={storage}
          speechInput={mockSpeechInput}
          onStart={onStart}
          onBack={vi.fn()}
          hardwareRuntime={desktopRuntime}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Local Model: Text-Only Enforced")).toBeDefined();
      });

      // Voice radio should be disabled with TEXT ONLY tag
      const voiceRadio = screen.getByRole("radio", { name: /voice/i });
      expect(voiceRadio).toHaveProperty("disabled", true);
      expect(screen.getByText("TEXT ONLY")).toBeDefined();
      expect(
        screen.getByText(
          /Voice is disabled in local mode to dedicate device resources to the model/i
        )
      ).toBeDefined();

      // Start session should produce text plan with isLocalModel and isSmallModel
      const startBtn = screen.getByRole("button", { name: /Start Session/i });
      expect(startBtn).toHaveProperty("disabled", false);
      fireEvent.click(startBtn);

      await waitFor(() => {
        expect(onStart).toHaveBeenCalledTimes(1);
      });

      const plan = onStart.mock.calls[0]?.[0];
      expect(plan.inputMode).toBe("text");
      expect(plan.isLocalModel).toBe(true);
      expect(plan.isSmallModel).toBe(true);
    });

    it("blocks starting session when local model (webllm) is configured on a phone", async () => {
      const storage = new MemoryStorageAdapter();
      await storage.put("providers", {
        id: "webllm",
        kind: "webllm",
        modelRoles: { interviewer: "SmolLM2-1.7B-Instruct-q4f16_1-MLC" },
      });
      await storage.put("settings", {
        key: "activeProviderId",
        value: "webllm",
      });

      const onStart = vi.fn();
      const mobileRuntime = {
        hasWebGpu: () => false,
        isMobileDevice: () => true,
      };

      render(
        <SessionSetupScreen
          storage={storage}
          onStart={onStart}
          onBack={vi.fn()}
          hardwareRuntime={mobileRuntime}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Local mode cannot run on phones")).toBeDefined();
      });

      expect(
        screen.getByText(
          /Your configured AI provider is a local model, which is disabled on mobile devices/i
        )
      ).toBeDefined();

      // Start button should be disabled
      const startBtn = screen.getByRole("button", { name: /Start Session/i });
      expect(startBtn).toHaveProperty("disabled", true);
      fireEvent.click(startBtn);

      expect(onStart).not.toHaveBeenCalled();
    });
  });

  describe("Company Pack Selection (FR-025, ADR-008, M4.3)", () => {
    it("renders company picker and pre-selects initialCompanySlug", async () => {
      const storage = new MemoryStorageAdapter();
      render(
        <SessionSetupScreen
          storage={storage}
          onStart={vi.fn()}
          onBack={vi.fn()}
          initialCompanySlug="amazon"
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Amazon")).toBeTruthy();
        expect(screen.getByTestId("selected-company-verified")).toBeTruthy();
      });
      expect(screen.getByRole("button", { name: /Company context used/i })).toBeTruthy();
    });

    it("allows opening company context dialog and closing it", async () => {
      const storage = new MemoryStorageAdapter();
      render(
        <SessionSetupScreen
          storage={storage}
          onStart={vi.fn()}
          onBack={vi.fn()}
          initialCompanySlug="google"
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Google")).toBeTruthy();
      });

      const viewContextBtn = screen.getByRole("button", { name: /Company context used/i });
      fireEvent.click(viewContextBtn);

      await waitFor(() => {
        expect(screen.getByText("Company Context: Google")).toBeTruthy();
        expect(screen.getByText(/Core Values & Principles/i)).toBeTruthy();
      });

      const closeBtn = screen.getByRole("button", { name: /^Close$/i });
      fireEvent.click(closeBtn);

      await waitFor(() => {
        expect(screen.queryByText("Company Context: Google")).toBeNull();
      });
    });

    it("includes companySlug and companyName in SessionPlan when starting session", async () => {
      const storage = new MemoryStorageAdapter();
      const provider: ProviderRow = {
        id: "provider_1",
        kind: "gemini",
        modelRoles: { interviewer: "gemini-2.0-flash", evaluator: "gemini-2.0-flash" },
      };
      await storage.put("providers", provider);
      await storage.put("settings", { key: "activeProviderId", value: "provider_1" });

      const onStart = vi.fn();
      render(
        <SessionSetupScreen
          storage={storage}
          onStart={onStart}
          onBack={vi.fn()}
          initialCompanySlug="stripe"
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Stripe")).toBeTruthy();
      });

      const startBtn = screen.getByRole("button", { name: /Start Session/i });
      expect(startBtn).toHaveProperty("disabled", false);
      fireEvent.click(startBtn);

      await waitFor(() => {
        expect(onStart).toHaveBeenCalledTimes(1);
      });

      const plan = onStart.mock.calls[0]?.[0];
      expect(plan.companySlug).toBe("stripe");
      expect(plan.companyName).toBe("Stripe");
      expect(SessionPlanSchema.safeParse(plan).success).toBe(true);
    });

    it("allows skipping company context for a general session via Clear button", async () => {
      const storage = new MemoryStorageAdapter();
      const provider: ProviderRow = {
        id: "provider_1",
        kind: "gemini",
        modelRoles: { interviewer: "gemini-2.0-flash", evaluator: "gemini-2.0-flash" },
      };
      await storage.put("providers", provider);
      await storage.put("settings", { key: "activeProviderId", value: "provider_1" });

      const onStart = vi.fn();
      render(
        <SessionSetupScreen
          storage={storage}
          onStart={onStart}
          onBack={vi.fn()}
          initialCompanySlug="google"
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Google")).toBeTruthy();
      });

      const clearBtn = screen.getByRole("button", { name: /Clear \(general session\)/i });
      fireEvent.click(clearBtn);

      const startBtn = screen.getByRole("button", { name: /Start Session/i });
      fireEvent.click(startBtn);

      await waitFor(() => {
        expect(onStart).toHaveBeenCalledTimes(1);
      });

      const plan = onStart.mock.calls[0]?.[0];
      expect(plan.companySlug).toBeUndefined();
      expect(plan.companyName).toBeUndefined();
    });

    it("renders stale badge when cached pack exceeds TTL", async () => {
      const storage = new MemoryStorageAdapter();
      const basePack = getSeedCompanyPack("netflix")!;
      const pastDate = new Date(Date.now() - 150 * 86400 * 1000).toISOString();
      const stalePack = {
        ...basePack,
        retrievedAt: pastDate,
      };
      await storage.put("companyCache", {
        slug: "netflix",
        pack: stalePack,
        fetchedAt: pastDate,
        packVersion: stalePack.schemaVersion,
      });

      render(
        <SessionSetupScreen
          storage={storage}
          onStart={vi.fn()}
          onBack={vi.fn()}
          initialCompanySlug="netflix"
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Netflix")).toBeTruthy();
        expect(screen.getByTestId("selected-company-stale")).toBeTruthy();
        expect(screen.getByText("STALE (TTL EXCEEDED)")).toBeTruthy();
      });
    });

    it("displays 'REQUESTED ✓' without counts in autocomplete list (M5.4, FR-026)", async () => {
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
        <SessionSetupScreen
          storage={storage}
          onStart={vi.fn()}
          onBack={vi.fn()}
          apiUrl="http://api.test"
        />
      );

      const input = screen.getByRole("combobox");
      fireEvent.focus(input);

      await waitFor(() => {
        const badge = screen.getByTestId("company-picker-status-requested");
        expect(badge).toBeTruthy();
        expect(badge.textContent).toBe("REQUESTED ✓");
        expect(badge.textContent).not.toMatch(/\d+/);
      });
    });

    it("shows '+ Request pack' item in dropdown when typing unlisted company and opens dialog (M5.4)", async () => {
      const storage = new MemoryStorageAdapter();
      render(<SessionSetupScreen storage={storage} onStart={vi.fn()} onBack={vi.fn()} />);

      const input = screen.getByRole("combobox");
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: "Linear" } });

      await waitFor(() => {
        expect(screen.getByTestId("request-company-picker-btn")).toBeTruthy();
        expect(screen.getByText(/Request pack for "Linear"/i)).toBeTruthy();
      });

      const requestItem = screen.getByTestId("request-company-picker-btn");
      fireEvent.click(requestItem);

      await waitFor(() => {
        expect(screen.getByText(/Request a Company Pack/i)).toBeTruthy();
      });
    });
  });

  describe("Accessibility (axe)", () => {
    it("has zero axe violations under Ink theme in default state", async () => {
      const storage = new MemoryStorageAdapter();
      const { container } = render(
        <div data-theme="ink">
          <SessionSetupScreen storage={storage} onStart={vi.fn()} onBack={vi.fn()} />
        </div>
      );
      await screen.findByText("Set Up Your Session");

      const results = await axe(container);
      expect(results.violations).toEqual([]);
    });

    it("has zero axe violations under Paper theme in default state", async () => {
      const storage = new MemoryStorageAdapter();
      const { container } = render(
        <div data-theme="paper">
          <SessionSetupScreen storage={storage} onStart={vi.fn()} onBack={vi.fn()} />
        </div>
      );
      await screen.findByText("Set Up Your Session");

      const results = await axe(container);
      expect(results.violations).toEqual([]);
    });
  });
});
