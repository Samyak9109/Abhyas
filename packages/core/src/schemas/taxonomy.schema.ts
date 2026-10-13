// FR-014: Skill taxonomy schema and types for measuring candidate abilities.
import { z } from "zod";

export const SkillCategorySchema = z.enum(["technical", "behavioral", "delivery"]);
export type SkillCategory = z.infer<typeof SkillCategorySchema>;

export const SkillDefinitionSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_-]+$/, "Skill ID must be lowercase alphanumeric with underscores/dashes"),
  name: z.string().min(1).max(60),
  category: SkillCategorySchema,
  description: z.string().min(10).max(280),
});
export type SkillDefinition = z.infer<typeof SkillDefinitionSchema>;

export const TaxonomySchema = z
  .object({
    version: z.number().int().positive(),
    skills: z.array(SkillDefinitionSchema).min(1),
  })
  .refine(
    (data) => {
      const ids = new Set<string>();
      for (const skill of data.skills) {
        if (ids.has(skill.id)) {
          return false;
        }
        ids.add(skill.id);
      }
      return true;
    },
    {
      message: "Taxonomy skills must have unique IDs",
      path: ["skills"],
    }
  );
export type Taxonomy = z.infer<typeof TaxonomySchema>;
