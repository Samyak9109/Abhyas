// FR-025, AI-014, ADR-008: Pack condenser for layered interview context injection.
// Condenses evidenced company pack fields into compact, injection-safe text conforming to token budgets.
import type { CompanyPack } from "../schemas/pack.schema.js";

export interface CondenseCompanyPackOptions {
  /** Target small local models (targets <= 400 tokens / 1,600 chars per AI-014) */
  isSmallModel?: boolean | undefined;
  /** Custom character limit override */
  maxChars?: number | undefined;
}

/**
 * Condenses an evidenced CompanyPack into a structured, bounded text summary
 * respecting token budgets (<= 1,500 tokens / ~6,000 chars for standard cloud models,
 * <= 400 tokens / ~1,600 chars for small models per FR-025 & AI-014).
 *
 * Design intent:
 * - Omits unevidenced or missing fields completely to prevent hallucination.
 * - Formats sections deterministically for cache efficiency and test repeatability.
 * - Caps item lists for small local models to preserve context window for candidate turns.
 */
export function condenseCompanyPack(
  pack: CompanyPack,
  options?: CondenseCompanyPackOptions
): string {
  const isSmallModel = options?.isSmallModel ?? false;
  const maxChars = options?.maxChars ?? (isSmallModel ? 1600 : 6000);

  const sections: string[] = [];

  // 1. Overview
  if (pack.overview?.value) {
    sections.push(`Overview: ${pack.overview.value}`);
  }

  // 2. Products
  if (pack.products?.value && pack.products.value.length > 0) {
    const prods = isSmallModel ? pack.products.value.slice(0, 4) : pack.products.value;
    sections.push(`Key Products: ${prods.join(", ")}`);
  }

  // 3. Documented Tech Stack
  if (pack.techStack?.value && pack.techStack.value.length > 0) {
    const stack = isSmallModel ? pack.techStack.value.slice(0, 8) : pack.techStack.value;
    sections.push(`Documented Tech Stack: ${stack.join(", ")}`);
  }

  // 4. Core Values & Principles
  if (pack.values?.value && pack.values.value.length > 0) {
    const valuesList = isSmallModel
      ? pack.values.value.slice(0, 4).map((v) => `${v.name}: ${v.description.slice(0, 80)}`)
      : pack.values.value.map((v) => `${v.name}: ${v.description}`);
    sections.push(`Core Values:\n- ${valuesList.join("\n- ")}`);
  }

  // 5. Documented Interview Process
  if (pack.interviewProcess?.value && pack.interviewProcess.value.length > 0) {
    const steps = isSmallModel
      ? pack.interviewProcess.value.slice(0, 3)
      : pack.interviewProcess.value;
    sections.push(`Documented Interview Process: ${steps.join(" -> ")}`);
  }

  // 6. Culture Signals
  if (pack.cultureSignals?.value && pack.cultureSignals.value.length > 0) {
    const signals = isSmallModel
      ? pack.cultureSignals.value.slice(0, 2)
      : pack.cultureSignals.value;
    sections.push(`Culture Signals: ${signals.join("; ")}`);
  }

  let result = sections.join("\n\n");
  if (result.length > maxChars) {
    result = `${result.slice(0, maxChars - 3)}...`;
  }

  return result;
}
