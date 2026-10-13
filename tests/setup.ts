// Vitest setup for DOM and Axe accessibility testing
import * as matchers from "vitest-axe/matchers.js";
import { expect } from "vitest";

expect.extend(matchers);
