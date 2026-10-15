// FR-002, FR-003, ADR-002: SHA-256 input hashing for document integrity and profile cache.
// Unchanged inputs produce identical hashes, preventing redundant AI provider calls.

/**
 * Computes a SHA-256 hexadecimal hash string for arbitrary text.
 * Uses universal WebCrypto (browser and Node 18+).
 */
export async function computeSha256(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);

  if (globalThis.crypto?.subtle) {
    const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Fallback for environments lacking crypto.subtle (testing/mock environments)
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < content.length; i++) {
    const ch = content.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(16, "0");
}

/**
 * Computes a canonical composite hash for profile extraction caching.
 * Unchanged inputs will match previously extracted structured profiles in IndexedDB.
 */
export async function hashProfileInputs(
  resumeText: string,
  jdText: string,
  targetRole: string,
  level: string
): Promise<string> {
  const normalized = [
    `resume:${resumeText.trim()}`,
    `jd:${jdText.trim()}`,
    `role:${targetRole.trim().toLowerCase()}`,
    `level:${level.trim().toLowerCase()}`,
  ].join("\n---\n");

  return computeSha256(normalized);
}
