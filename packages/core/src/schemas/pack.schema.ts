// FR-025, ADR-008: Shared contract schema for evidenced company packs.
// Every claim carries evidence (source URL, title, date) and confidence label.
// Hallucination is structurally discouraged: fields without evidence cannot exist.
import { z } from "zod";

export const IsoDateString = z
  .string()
  .min(1, "Date string is required")
  .refine(
    (val) => {
      if (!/^\d{4}-\d{2}-\d{2}/.test(val)) return false;
      const parsed = Date.parse(val);
      return !Number.isNaN(parsed);
    },
    { message: "Date must be a valid ISO-8601 date (e.g. YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ)" }
  );

export const EvidenceSourceSchema = z.object({
  url: z.string().url("Evidence source url must be a valid URL"),
  title: z.string().trim().min(1, "Evidence source title is required").max(200),
  retrievedAt: IsoDateString,
});
export type EvidenceSource = z.infer<typeof EvidenceSourceSchema>;

export const Evidenced = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z
    .object({
      value: valueSchema,
      confidence: z.enum(["documented", "inferred", "unknown"]),
      sources: z
        .array(EvidenceSourceSchema)
        .min(1, "Every evidenced field must contain at least one source with evidence (ADR-008)"),
    })
    .refine((data) => data.confidence !== "unknown", {
      message:
        "Fields with 'unknown' confidence should be omitted rather than filled in (architecture.md 15.1)",
    });

export const CompanyPackSchema = z
  .object({
    schemaVersion: z.literal(1),
    slug: z
      .string()
      .min(1)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug must be lowercase alphanumeric with single hyphens (e.g. 'stripe', 'google')"
      ),
    name: z.string().trim().min(1, "Company name is required"),
    domain: z.string().trim().min(1, "Company domain is required"),
    aliases: z.array(z.string().trim().min(1)),
    retrievedAt: IsoDateString,
    ttlDays: z.number().int().positive("ttlDays must be a positive integer"),
    overview: Evidenced(z.string().trim().min(1).max(600)).optional(),
    products: Evidenced(z.array(z.string().trim().min(1)).min(1)).optional(),
    techStack: Evidenced(z.array(z.string().trim().min(1)).min(1)).optional(),
    values: Evidenced(
      z
        .array(
          z.object({
            name: z.string().trim().min(1, "Value name is required"),
            description: z.string().trim().min(1, "Value description is required").max(240),
          })
        )
        .min(1)
    ).optional(),
    interviewProcess: Evidenced(z.array(z.string().trim().min(1)).min(1)).optional(),
    cultureSignals: Evidenced(z.array(z.string().trim().min(1)).min(1)).optional(),
    coverage: z.enum(["high", "medium", "low"]),
  })
  .refine(
    (pack) =>
      Boolean(
        pack.overview ||
          pack.products ||
          pack.techStack ||
          pack.values ||
          pack.interviewProcess ||
          pack.cultureSignals
      ),
    {
      message:
        "Company pack must contain at least one evidenced section (overview, products, techStack, values, interviewProcess, or cultureSignals) (FR-025, ADR-008)",
    }
  );
export type CompanyPack = z.infer<typeof CompanyPackSchema>;

export const CompanyPackStatusSchema = z.enum([
  "ready",
  "stale",
  "requested",
  "queued",
  "researching",
  "insufficient_data",
  "unknown",
]);
export type CompanyPackStatus = z.infer<typeof CompanyPackStatusSchema>;

export const CompanyPackIndexItemSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  domain: z.string().min(1),
  aliases: z.array(z.string()),
  coverage: z.enum(["high", "medium", "low"]),
  status: CompanyPackStatusSchema,
  retrievedAt: IsoDateString.optional(),
  ttlDays: z.number().int().positive().optional(),
});
export type CompanyPackIndexItem = z.infer<typeof CompanyPackIndexItemSchema>;

export const CompanyPackIndexSchema = z.object({
  version: z.literal(1),
  updatedAt: IsoDateString,
  companies: z.array(CompanyPackIndexItemSchema),
});
export type CompanyPackIndex = z.infer<typeof CompanyPackIndexSchema>;
