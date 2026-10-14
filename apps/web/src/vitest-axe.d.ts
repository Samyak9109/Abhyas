// vitest-axe 0.1.0 only augments the legacy global `Vi` namespace (Vitest 0.x), so
// `toHaveNoViolations` is invisible to Vitest 3 types. Custom matchers must merge
// into the global `jest.Matchers` extension point that @vitest/expect's `Assertion`
// inherits; TypeScript merges it only when the type parameter names match exactly.
// Matchers are registered at runtime in tests/setup.ts (NFR-011).
import type { NoViolationsMatcherResult } from "vitest-axe/matchers";

declare global {
  namespace jest {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- R and T are required for declaration merging but unused by the matcher
    interface Matchers<R, T = unknown> {
      toHaveNoViolations(): NoViolationsMatcherResult;
    }
  }
}
