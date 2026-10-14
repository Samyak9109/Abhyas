// Vitest setup for DOM and Axe accessibility testing
import * as matchers from "vitest-axe/matchers.js";
import { expect } from "vitest";

expect.extend(matchers);

// jsdom does not implement matchMedia; theme resolution (FR-030) needs it.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = ((query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => true,
  })) as typeof window.matchMedia;
}
