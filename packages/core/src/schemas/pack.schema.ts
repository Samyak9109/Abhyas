// FR-025, ADR-011: Shared contract schema for evidenced company packs.
import { z } from "zod";

export const Evidenced = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.object({
    value: valueSchema,
    confidence: z.enum(["documented", "inferred", "unknown"]),
    sources: z
      .array(
        z.object({
          url: z.string().url(),
          title: z.string(),
          retrievedAt: z.string(),
        })
      )
      .min(1),
  });

export const CompanyPackSchema = z.object({
  schemaVersion: z.literal(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  domain: z.string().min(1),
  aliases: z.array(z.string()),
  retrievedAt: z.string(),
  ttlDays: z.number().int().positive(),
  overview: Evidenced(z.string().max(600)).optional(),
  products: Evidenced(z.array(z.string())).optional(),
  techStack: Evidenced(z.array(z.string())).optional(),
  values: Evidenced(
    z.array(
      z.object({
        name: z.string(),
        description: z.string().max(240),
      })
    )
  ).optional(),
  interviewProcess: Evidenced(z.array(z.string())).optional(),
  cultureSignals: Evidenced(z.array(z.string())).optional(),
  coverage: z.enum(["high", "medium", "low"]),
});
export type CompanyPack = z.infer<typeof CompanyPackSchema>;
