// FR-025, ADR-008: Curated seed company packs and accessors for popular tech employers.
import type {
  CompanyPack,
  CompanyPackIndex,
  CompanyPackIndexItem,
  CompanyPackStatus,
} from "@abhyas/core";

import googlePack from "../packs/google.json" with { type: "json" };
import amazonPack from "../packs/amazon.json" with { type: "json" };
import microsoftPack from "../packs/microsoft.json" with { type: "json" };
import metaPack from "../packs/meta.json" with { type: "json" };
import applePack from "../packs/apple.json" with { type: "json" };
import netflixPack from "../packs/netflix.json" with { type: "json" };
import stripePack from "../packs/stripe.json" with { type: "json" };
import uberPack from "../packs/uber.json" with { type: "json" };
import airbnbPack from "../packs/airbnb.json" with { type: "json" };
import spotifyPack from "../packs/spotify.json" with { type: "json" };
import githubPack from "../packs/github.json" with { type: "json" };
import salesforcePack from "../packs/salesforce.json" with { type: "json" };

export type { CompanyPack, CompanyPackIndex, CompanyPackIndexItem, CompanyPackStatus };

/**
 * All statically curated, hand-reviewed seed company packs.
 */
export const SEED_COMPANY_PACKS: readonly CompanyPack[] = [
  googlePack as unknown as CompanyPack,
  amazonPack as unknown as CompanyPack,
  microsoftPack as unknown as CompanyPack,
  metaPack as unknown as CompanyPack,
  applePack as unknown as CompanyPack,
  netflixPack as unknown as CompanyPack,
  stripePack as unknown as CompanyPack,
  uberPack as unknown as CompanyPack,
  airbnbPack as unknown as CompanyPack,
  spotifyPack as unknown as CompanyPack,
  githubPack as unknown as CompanyPack,
  salesforcePack as unknown as CompanyPack,
];

/**
 * Static index of all seed company packs for fast autocomplete, directory search, and status lookup.
 */
export const SEED_COMPANY_PACK_INDEX: CompanyPackIndex = {
  version: 1,
  updatedAt: "2026-10-18T10:00:00.000Z",
  companies: SEED_COMPANY_PACKS.map((pack) => ({
    slug: pack.slug,
    name: pack.name,
    domain: pack.domain,
    aliases: pack.aliases,
    coverage: pack.coverage,
    status: "ready" as const,
    retrievedAt: pack.retrievedAt,
    ttlDays: pack.ttlDays,
  })),
};

/**
 * Look up a seed company pack by its unique kebab-case slug.
 */
export function getSeedCompanyPack(slug: string): CompanyPack | undefined {
  return SEED_COMPANY_PACKS.find((p) => p.slug === slug);
}

/**
 * Look up a seed company pack by canonical domain (e.g. "google.com").
 */
export function getSeedCompanyPackByDomain(domain: string): CompanyPack | undefined {
  const normalized = domain.toLowerCase().trim();
  return SEED_COMPANY_PACKS.find((p) => p.domain.toLowerCase() === normalized);
}

/**
 * Search seed company packs by query string matching name, slug, aliases, or domain.
 */
export function searchSeedCompanyPacks(query: string): CompanyPackIndexItem[] {
  const clean = query.toLowerCase().trim();
  if (!clean) return [...SEED_COMPANY_PACK_INDEX.companies];

  return SEED_COMPANY_PACK_INDEX.companies.filter((item) => {
    if (item.name.toLowerCase().includes(clean)) return true;
    if (item.slug.toLowerCase().includes(clean)) return true;
    if (item.domain.toLowerCase().includes(clean)) return true;
    return item.aliases.some((alias) => alias.toLowerCase().includes(clean));
  });
}
