// FR-014, FR-017, ADR-006: In-memory content validation engine for taxonomy, rubrics, and question bank.
import {
  TaxonomySchema,
  RubricLevelSchema,
  QuestionBankSchema,
  ExperienceLevelSchema,
  type Taxonomy,
  type RubricLevel,
  type QuestionBank,
  type ExperienceLevel,
} from "@abhyas/core";

export interface ValidationResult {
  valid: boolean;
  summary: {
    skillsCount: number;
    rubricsCount: number;
    questionsCount: number;
  };
  errors: string[];
}

/**
 * Validates a skill taxonomy object against TaxonomySchema.
 */
export function validateTaxonomy(data: unknown): Taxonomy {
  const result = TaxonomySchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Taxonomy validation failed: ${issues}`);
  }
  return result.data;
}

/**
 * Validates a level rubric object against RubricLevelSchema.
 */
export function validateRubric(data: unknown): RubricLevel {
  const result = RubricLevelSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Rubric validation failed: ${issues}`);
  }
  return result.data;
}

/**
 * Validates a question bank array against QuestionBankSchema and optional taxonomy skill IDs.
 */
export function validateQuestionBank(data: unknown, validSkillIds?: Set<string>): QuestionBank {
  const result = QuestionBankSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Question bank validation failed: ${issues}`);
  }

  // Cross-reference skillTags with taxonomy if validSkillIds are provided
  if (validSkillIds) {
    const errors: string[] = [];
    for (const q of result.data) {
      for (const tag of q.skillTags) {
        if (!validSkillIds.has(tag)) {
          errors.push(
            `Question "${q.id}" contains unknown skill tag "${tag}" not in taxonomy (FR-014)`
          );
        }
      }
    }
    if (errors.length > 0) {
      throw new Error(`Question bank taxonomy verification failed: ${errors.join("; ")}`);
    }
  }

  return result.data;
}

export const REQUIRED_EXPERIENCE_LEVELS: readonly ExperienceLevel[] = [
  "intern_fresher",
  "junior",
  "mid",
  "senior",
  "staff_plus",
];

export { ExperienceLevelSchema };
