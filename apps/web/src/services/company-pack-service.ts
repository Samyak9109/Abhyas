// FR-025, ADR-008: Client company pack service with offline caching, TTL evaluation, and search.
import type { StorageAdapter } from "@abhyas/core";
import {
  CompanyPackSchema,
  type CompanyPack,
  type CompanyPackIndexItem,
  type CompanyCacheRow,
} from "@abhyas/core";
import {
  getSeedCompanyPack,
  SEED_COMPANY_PACK_INDEX,
  searchSeedCompanyPacks,
} from "@abhyas/content";

/**
 * Evaluates whether a company pack's evidence has exceeded its Time-To-Live (TTL).
 * Default TTL is 90 days unless specified otherwise in pack.ttlDays (FR-025, ADR-008).
 */
export function isPackStale(retrievedAt: string, ttlDays = 90, nowMs = Date.now()): boolean {
  const retrievedTime = Date.parse(retrievedAt);
  if (Number.isNaN(retrievedTime)) return false;
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000;
  return nowMs - retrievedTime > ttlMs;
}

interface CachedCompanyPackResult {
  pack: CompanyPack;
  isStale: boolean;
  fromCache: boolean;
}

/**
 * Loads a company pack by slug.
 * 1. Checks offline IndexedDB companyCache first (FR-001, ADR-004).
 * 2. Falls back to bundled static seed packs from @abhyas/content.
 * 3. Caches pack into IndexedDB on first load for offline availability.
 * 4. Checks and tags whether evidence is stale past its TTL.
 */
export async function loadCompanyPack(
  slug: string,
  storage: StorageAdapter
): Promise<CachedCompanyPackResult | null> {
  const normalizedSlug = slug.toLowerCase().trim();

  // 1. Check local IndexedDB storage cache
  try {
    const cachedRow = await storage.get<CompanyCacheRow>("companyCache", normalizedSlug);
    if (cachedRow && cachedRow.pack) {
      const parsed = CompanyPackSchema.safeParse(cachedRow.pack);
      if (parsed.success) {
        const pack = parsed.data;
        const stale = isPackStale(pack.retrievedAt, pack.ttlDays);
        return {
          pack,
          isStale: stale,
          fromCache: true,
        };
      }
    }
  } catch {
    // Graceful fallback to static bundled packs on storage error
  }

  // 2. Fall back to bundled static seed pack
  const seedPack = getSeedCompanyPack(normalizedSlug);
  if (!seedPack) {
    return null;
  }

  const isStale = isPackStale(seedPack.retrievedAt, seedPack.ttlDays);

  // 3. Persist to IndexedDB cache so it works offline on subsequent loads
  try {
    const cacheRow: CompanyCacheRow = {
      slug: seedPack.slug,
      pack: seedPack,
      fetchedAt: new Date().toISOString(),
      packVersion: seedPack.schemaVersion,
    };
    await storage.put("companyCache", cacheRow);
  } catch {
    // In-memory or storage full; non-fatal
  }

  return {
    pack: seedPack,
    isStale,
    fromCache: false,
  };
}

export type CompanyDirectoryItem = CompanyPackIndexItem & {
  isStale: boolean;
};

/**
 * Returns all available companies in the directory with computed stale flags.
 */
export function getCompanyDirectory(): CompanyDirectoryItem[] {
  return SEED_COMPANY_PACK_INDEX.companies.map((company) => {
    const stale = company.retrievedAt
      ? isPackStale(company.retrievedAt, company.ttlDays ?? 90)
      : false;
    return {
      ...company,
      status: stale ? ("stale" as const) : company.status,
      isStale: stale,
    };
  });
}

/**
 * Searches company directory by query string with computed stale flags.
 */
export function searchCompanies(query: string): CompanyDirectoryItem[] {
  const matched = searchSeedCompanyPacks(query);
  return matched.map((company) => {
    const stale = company.retrievedAt
      ? isPackStale(company.retrievedAt, company.ttlDays ?? 90)
      : false;
    return {
      ...company,
      status: stale ? ("stale" as const) : company.status,
      isStale: stale,
    };
  });
}
