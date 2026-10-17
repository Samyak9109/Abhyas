// FR-031, PG-08, architecture.md 16: PWA manifest, service worker caching, and registration tests.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { registerPwa } from "./pwa.js";

describe("PWA Manifest & Service Worker (FR-031)", () => {
  const publicDir = path.resolve(__dirname, "../../public");

  it("manifest.webmanifest exists and contains valid PWA specification", () => {
    const manifestPath = path.join(publicDir, "manifest.webmanifest");
    expect(fs.existsSync(manifestPath)).toBe(true);

    const raw = fs.readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(raw);

    expect(manifest.name).toBe("Abhyas");
    expect(manifest.short_name).toBe("Abhyas");
    expect(manifest.start_url).toBe("/app/home");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toBe("#121110");
    expect(manifest.background_color).toBe("#121110");
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);

    const svgIcon = manifest.icons.find((i: { type?: string }) => i.type === "image/svg+xml");
    expect(svgIcon).toBeDefined();
    expect(svgIcon.src).toBe("/icon.svg");
  });

  it("icon.svg exists and defines the retro monitor-head interviewer glyph", () => {
    const iconPath = path.join(publicDir, "icon.svg");
    expect(fs.existsSync(iconPath)).toBe(true);

    const iconContent = fs.readFileSync(iconPath, "utf-8");
    expect(iconContent).toContain("<svg");
    expect(iconContent).toContain("viewBox");
    expect(iconContent).toContain("#FF6A2B"); // Accent color
  });

  it("sw.js exists and configures correct offline caching and egress boundaries", () => {
    const swPath = path.join(publicDir, "sw.js");
    expect(fs.existsSync(swPath)).toBe(true);

    const swContent = fs.readFileSync(swPath, "utf-8");

    // Precache shell assets
    expect(swContent).toContain("/app/index.html");
    expect(swContent).toContain("/manifest.webmanifest");
    expect(swContent).toContain("/icon.svg");
    expect(swContent).toContain("/theme-init.js");

    // Egress boundaries: must never cache external AI provider or local model traffic
    expect(swContent).toContain("generativelanguage.googleapis.com");
    expect(swContent).toContain("api.openai.com");
    expect(swContent).toContain("localhost");
    expect(swContent).toContain("127.0.0.1");

    // Skip waiting message handler
    expect(swContent).toContain("SKIP_WAITING");
  });
});

describe("registerPwa service worker registration flow", () => {
  let originalWindow: typeof globalThis.window;
  let originalNavigator: typeof globalThis.navigator;

  beforeEach(() => {
    originalWindow = globalThis.window;
    originalNavigator = globalThis.navigator;
  });

  afterEach(() => {
    globalThis.window = originalWindow;
    globalThis.navigator = originalNavigator;
    vi.restoreAllMocks();
  });

  it("gracefully does nothing if navigator.serviceWorker is not supported", () => {
    // @ts-expect-error Mocking navigator without serviceWorker
    globalThis.navigator = {};
    const onUpdateAvailable = vi.fn();

    expect(() => registerPwa({ onUpdateAvailable })).not.toThrow();
    expect(onUpdateAvailable).not.toHaveBeenCalled();
  });

  it("registers /sw.js on window load and triggers update callback if worker is waiting", async () => {
    const postMessageSpy = vi.fn();
    const mockWaitingWorker = {
      state: "installed",
      postMessage: postMessageSpy,
    } as unknown as ServiceWorker;

    const mockRegistration = {
      waiting: mockWaitingWorker,
      installing: null,
      addEventListener: vi.fn(),
    };

    const registerMock = vi.fn().mockResolvedValue(mockRegistration);
    const swAddEventListenerMock = vi.fn();

    globalThis.window = {
      addEventListener: vi.fn((event: string, handler: () => void) => {
        if (event === "load") {
          handler();
        }
      }),
      location: { reload: vi.fn() },
    } as unknown as Window & typeof globalThis;

    globalThis.navigator = {
      serviceWorker: {
        register: registerMock,
        addEventListener: swAddEventListenerMock,
        controller: {} as ServiceWorker,
      },
    } as unknown as Navigator;

    const onUpdateAvailable = vi.fn();
    registerPwa({ onUpdateAvailable });

    // Wait microtasks
    await Promise.resolve();
    await Promise.resolve();

    expect(registerMock).toHaveBeenCalledWith("/sw.js");
    expect(onUpdateAvailable).toHaveBeenCalledTimes(1);

    // Call the reload callback passed to onUpdateAvailable
    const reloadFn = onUpdateAvailable.mock.calls[0]?.[0] as (() => void) | undefined;
    expect(reloadFn).toBeDefined();
    reloadFn!();
    expect(postMessageSpy).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });

  it("listens for updatefound on background service worker updates", async () => {
    const postMessageSpy = vi.fn();
    let stateChangeHandler: (() => void) | null = null;
    let updateFoundHandler: (() => void) | null = null;

    const mockInstallingWorker = {
      state: "installing",
      postMessage: postMessageSpy,
      addEventListener: vi.fn((event: string, handler: () => void) => {
        if (event === "statechange") {
          stateChangeHandler = handler;
        }
      }),
    };

    const mockRegistration = {
      waiting: null,
      installing: mockInstallingWorker,
      addEventListener: vi.fn((event: string, handler: () => void) => {
        if (event === "updatefound") {
          updateFoundHandler = handler;
        }
      }),
    };

    const registerMock = vi.fn().mockResolvedValue(mockRegistration);

    globalThis.window = {
      addEventListener: vi.fn((event: string, handler: () => void) => {
        if (event === "load") {
          handler();
        }
      }),
      location: { reload: vi.fn() },
    } as unknown as Window & typeof globalThis;

    globalThis.navigator = {
      serviceWorker: {
        register: registerMock,
        addEventListener: vi.fn(),
        controller: {} as ServiceWorker, // active controller exists
      },
    } as unknown as Navigator;

    const onUpdateAvailable = vi.fn();
    registerPwa({ onUpdateAvailable });

    await Promise.resolve();
    await Promise.resolve();

    expect(onUpdateAvailable).not.toHaveBeenCalled();

    // Trigger updatefound
    if (updateFoundHandler) {
      (updateFoundHandler as () => void)();
    }

    // Now transition state to installed
    mockInstallingWorker.state = "installed";
    if (stateChangeHandler) {
      (stateChangeHandler as () => void)();
    }

    expect(onUpdateAvailable).toHaveBeenCalledTimes(1);
    const reloadFn = onUpdateAvailable.mock.calls[0]?.[0] as (() => void) | undefined;
    expect(reloadFn).toBeDefined();
    reloadFn!();
    expect(postMessageSpy).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });
});
