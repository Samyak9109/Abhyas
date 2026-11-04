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

// In Node 22/26 environments, jsdom window.localStorage may be disabled without --localstorage-file
if (typeof window !== "undefined" && !window.localStorage) {
  const store = new Map<string, string>();
  window.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}
