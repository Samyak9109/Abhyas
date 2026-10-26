// FR-025, FR-026, FR-029, ADR-008, ADR-010: Client company pack service.
// Supports offline caching, static mirror fallback, remote API autocomplete/status,
// anonymous demand registration, and data inaccuracy reporting.
import type { StorageAdapter } from "@abhyas/core";
import {
  CompanyPackSchema,
  CompanyPackIndexSchema,
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

export type CompanyDirectoryItem = CompanyPackIndexItem & {
  isStale: boolean;
};

/**
 * Returns default configured API URL or empty string if disabled.
 */
function getApiUrl(): string {
  const metaEnv = (import.meta as unknown as { env?: Record<string, string> }).env;
  const url = metaEnv?.VITE_API_URL ?? "";
  return url.trim().replace(/\/+$/, "");
}

/**
 * Returns default static packs mirror URL (e.g. /packs or remote CDN).
 */
function getStaticPacksUrl(): string {
  const metaEnv = (import.meta as unknown as { env?: Record<string, string> }).env;
  const url = metaEnv?.VITE_STATIC_PACKS_URL ?? "/packs";
  return url.trim().replace(/\/+$/, "");
}

/**
 * Retrieves or generates an anonymous client token for demand counting (ADR-010).
 * Stored locally in storage or localStorage; contains zero personal data.
 */
export async function getClientToken(storage?: StorageAdapter): Promise<string> {
  const SETTING_KEY = "clientDemandToken";

  if (storage) {
    try {
      const existing = await storage.get<{ key: string; value: string }>("settings", SETTING_KEY);
      if (existing?.value && typeof existing.value === "string" && existing.value.length === 32) {
        return existing.value;
      }
    } catch {
      // Fall through to fallback
    }
  }

  // Check localStorage if available in browser
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(SETTING_KEY);
      if (stored && stored.length === 32) {
        if (storage) {
          await storage.put("settings", { key: SETTING_KEY, value: stored }).catch(() => {});
        }
        return stored;
      }
    } catch {
      // LocalStorage access restricted (e.g. sandboxed iframe)
    }
  }

  // Generate random 16-byte hex token (zero personal or hardware identifiers)
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const newToken = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Persist for consistent deduplication
  if (storage) {
    await storage.put("settings", { key: SETTING_KEY, value: newToken }).catch(() => {});
  }
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(SETTING_KEY, newToken);
    } catch {
      // Ignored
    }
  }

  return newToken;
}

/**
 * Loads a company pack by slug.
 * Fallback order:
 * 1. Checks offline IndexedDB companyCache first (FR-001, ADR-004).
 * 2. If API is enabled/reachable, fetches GET /v1/companies/{slug}.
 * 3. Falls back to static mirror (GET {staticPacksUrl}/{slug}.json).
 * 4. Falls back to bundled static seed packs from @abhyas/content.
 * 5. Returns null if pack is absent or research is pending (triggering general session).
 */
export async function loadCompanyPack(
  slug: string,
  storage: StorageAdapter,
  options?: {
    apiUrl?: string | undefined;
    staticPacksUrl?: string | undefined;
  }
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
    // Graceful fallback on storage read error
  }

  const effectiveApiUrl =
    options?.apiUrl !== undefined ? options.apiUrl.replace(/\/+$/, "") : getApiUrl();
  const effectiveStaticUrl =
    options?.staticPacksUrl !== undefined
      ? options.staticPacksUrl.replace(/\/+$/, "")
      : getStaticPacksUrl();

  // 2. Fetch from backend research API if URL is configured
  if (effectiveApiUrl) {
    try {
      const resp = await fetch(
        `${effectiveApiUrl}/v1/companies/${encodeURIComponent(normalizedSlug)}`
      );
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.pack) {
          const parsed = CompanyPackSchema.safeParse(data.pack);
          if (parsed.success) {
            const pack = parsed.data;
            const stale = isPackStale(pack.retrievedAt, pack.ttlDays);
            // Cache locally for offline availability
            await storage
              .put("companyCache", {
                slug: pack.slug,
                pack,
                fetchedAt: new Date().toISOString(),
                packVersion: pack.schemaVersion,
              })
              .catch(() => {});

            return {
              pack,
              isStale: stale,
              fromCache: false,
            };
          }
        }
      }
    } catch {
      // Backend unreachable or network offline; proceed to static mirror
    }
  }

  // 3. Try static mirror endpoint
  if (effectiveStaticUrl) {
    try {
      const mirrorResp = await fetch(
        `${effectiveStaticUrl}/${encodeURIComponent(normalizedSlug)}.json`
      );
      if (mirrorResp.ok) {
        const mirrorData = await mirrorResp.json();
        const parsed = CompanyPackSchema.safeParse(mirrorData);
        if (parsed.success) {
          const pack = parsed.data;
          const stale = isPackStale(pack.retrievedAt, pack.ttlDays);
          await storage
            .put("companyCache", {
              slug: pack.slug,
              pack,
              fetchedAt: new Date().toISOString(),
              packVersion: pack.schemaVersion,
            })
            .catch(() => {});

          return {
            pack,
            isStale: stale,
            fromCache: false,
          };
        }
      }
    } catch {
      // Static mirror fetch failed; fall through to bundled seeds
    }
  }

  // 4. Fall back to bundled static seed pack from @abhyas/content
  const seedPack = getSeedCompanyPack(normalizedSlug);
  if (seedPack) {
    const isStale = isPackStale(seedPack.retrievedAt, seedPack.ttlDays);
    await storage
      .put("companyCache", {
        slug: seedPack.slug,
        pack: seedPack,
        fetchedAt: new Date().toISOString(),
        packVersion: seedPack.schemaVersion,
      })
      .catch(() => {});

    return {
      pack: seedPack,
      isStale,
      fromCache: false,
    };
  }

  // 5. Pack does not exist or has not been researched yet -> return null
  return null;
}

/**
 * Returns all available companies from the bundled static index with computed stale flags.
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
 * Searches company directory locally by query string with computed stale flags.
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

/**
 * Fetches the company directory and current statuses.
 * 1. Attempts remote API GET /v1/companies?q= if configured.
 * 2. Attempts static mirror GET {staticPacksUrl}/index.json if API is disabled or fails.
 * 3. Falls back to bundled static index from @abhyas/content.
 */
export async function fetchCompanyDirectory(options?: {
  apiUrl?: string | undefined;
  staticPacksUrl?: string | undefined;
  query?: string | undefined;
}): Promise<CompanyDirectoryItem[]> {
  const query = options?.query?.trim().toLowerCase() ?? "";
  const effectiveApiUrl =
    options?.apiUrl !== undefined ? options.apiUrl.replace(/\/+$/, "") : getApiUrl();
  const effectiveStaticUrl =
    options?.staticPacksUrl !== undefined
      ? options.staticPacksUrl.replace(/\/+$/, "")
      : getStaticPacksUrl();

  // 1. Try remote API
  if (effectiveApiUrl) {
    try {
      const resp = await fetch(`${effectiveApiUrl}/v1/companies?q=${encodeURIComponent(query)}`);
      if (resp.ok) {
        const list = await resp.json();
        if (Array.isArray(list)) {
          return list.map((item) => {
            const stale = item.status === "stale";
            return {
              slug: item.slug,
              name: item.name,
              domain: item.domain,
              aliases: Array.isArray(item.aliases) ? item.aliases : [],
              coverage: item.coverage || "medium",
              status: item.status,
              retrievedAt: item.last_researched_at || undefined,
              ttlDays: 90,
              isStale: stale,
            };
          });
        }
      }
    } catch {
      // API offline or error; proceed to static mirror
    }
  }

  // 2. Try static mirror index
  if (effectiveStaticUrl) {
    try {
      const mirrorResp = await fetch(`${effectiveStaticUrl}/index.json`);
      if (mirrorResp.ok) {
        const mirrorData = await mirrorResp.json();
        const parsed = CompanyPackIndexSchema.safeParse(mirrorData);
        if (parsed.success) {
          const companies = parsed.data.companies.map((c) => {
            const stale = c.retrievedAt ? isPackStale(c.retrievedAt, c.ttlDays ?? 90) : false;
            return {
              ...c,
              status: stale ? ("stale" as const) : c.status,
              isStale: stale,
            };
          });
          if (query) {
            return companies.filter(
              (c) =>
                c.name.toLowerCase().includes(query) ||
                c.slug.toLowerCase().includes(query) ||
                c.domain.toLowerCase().includes(query) ||
                c.aliases.some((a) => a.toLowerCase().includes(query))
            );
          }
          return companies;
        }
      }
    } catch {
      // Mirror unavailable; proceed to bundled index
    }
  }

  // 3. Fall back to bundled static seed index
  return query ? searchCompanies(query) : getCompanyDirectory();
}

/**
 * Demand registration response shape.
 */
interface RequestCompanyResult {
  ok: boolean;
  status?: string;
  message?: string;
  offline?: boolean;
  error?: string;
}

/**
 * Registers user demand for an unlisted or requested company pack (FR-026, ADR-010).
 * Transmits zero personal data: uses anonymous client token and Turnstile challenge.
 */
export async function requestCompanyResearch(
  slug: string,
  options?: {
    domain?: string | undefined;
    apiUrl?: string | undefined;
    clientToken?: string | undefined;
    challengeToken?: string | undefined;
    storage?: StorageAdapter | undefined;
  }
): Promise<RequestCompanyResult> {
  const effectiveApiUrl =
    options?.apiUrl !== undefined ? options.apiUrl.replace(/\/+$/, "") : getApiUrl();
  if (!effectiveApiUrl) {
    return {
      ok: false,
      offline: true,
      error: "Research API endpoint is not configured",
    };
  }

  const clientToken = options?.clientToken || (await getClientToken(options?.storage));
  const payload = {
    domain: options?.domain?.trim() || undefined,
    client_token: clientToken,
    challenge_token: options?.challengeToken || "test-turnstile-token",
  };

  try {
    const cleanSlug = slug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const resp = await fetch(
      `${effectiveApiUrl}/v1/companies/${encodeURIComponent(cleanSlug)}/request`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await resp.json().catch(() => null);

    if (resp.ok) {
      return {
        ok: true,
        status: data?.status || "requested",
        message: data?.message || "Demand registered successfully",
      };
    }

    return {
      ok: false,
      offline: false,
      status: data?.status,
      error: data?.detail || data?.message || `Request failed with status ${resp.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      offline: true,
      error: (err as Error).message || "Network connection error",
    };
  }
}

/**
 * Inaccuracy reporting response shape.
 */
interface SubmitReportResult {
  ok: boolean;
  reportId?: number;
  offline?: boolean;
  error?: string;
}

/**
 * Submits a report flagging inaccurate company pack data (FR-029).
 */
export async function submitCompanyReport(
  companySlug: string,
  reason: string,
  options?: {
    packId?: number | undefined;
    field?: string | undefined;
    apiUrl?: string | undefined;
    challengeToken?: string | undefined;
  }
): Promise<SubmitReportResult> {
  const effectiveApiUrl =
    options?.apiUrl !== undefined ? options.apiUrl.replace(/\/+$/, "") : getApiUrl();
  if (!effectiveApiUrl) {
    return {
      ok: false,
      offline: true,
      error: "Research API endpoint is not configured",
    };
  }

  const payload = {
    company_slug: companySlug.toLowerCase().trim(),
    pack_id: options?.packId,
    field: options?.field?.trim() || undefined,
    reason: reason.trim(),
    challenge_token: options?.challengeToken || "test-turnstile-token",
  };

  try {
    const resp = await fetch(`${effectiveApiUrl}/v1/reports`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json().catch(() => null);

    if (resp.ok) {
      return {
        ok: true,
        reportId: data?.id,
      };
    }

    return {
      ok: false,
      offline: false,
      error: data?.detail || `Report failed with status ${resp.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      offline: true,
      error: (err as Error).message || "Network connection error",
    };
  }
}
