# Security & Threat Mitigation Review: Entire Codebase & Phase 7 Verification

Comprehensive verification of security controls, threat mitigations, and privacy boundaries across the entire Abhyas codebase ([`apps/web`](file:///home/samyak/Codes/Agents/Abhyas/apps/web), [`apps/api`](file:///home/samyak/Codes/Agents/Abhyas/apps/api), [`packages/core`](file:///home/samyak/Codes/Agents/Abhyas/packages/core), and [`packages/content`](file:///home/samyak/Codes/Agents/Abhyas/packages/content)).

---

## Security Tenets & Posture Verification

| Tenet | Architecture Rule | Status | Implementation Evidence |
| :--- | :--- | :---: | :--- |
| **Zero Server Egress for Prompts** | Prompts, resumes, and keys go strictly to user-selected provider (BYOK); 0 central proxy | **VERIFIED** | Direct browser adapters ([`GeminiAdapter`](file:///home/samyak/Codes/Agents/Abhyas/packages/core/src/providers/gemini-adapter.ts), [`OpenAICompatibleAdapter`](file:///home/samyak/Codes/Agents/Abhyas/packages/core/src/providers/openai-compatible-adapter.ts), [`AnthropicAdapter`](file:///home/samyak/Codes/Agents/Abhyas/packages/core/src/providers/anthropic-adapter.ts), [`HuggingFaceAdapter`](file:///home/samyak/Codes/Agents/Abhyas/packages/core/src/providers/huggingface-adapter.ts)) communicate directly with official provider APIs with `assertAllowedDestination` checks. |
| **Self-Hosted Assets** | Fonts, icons, scripts served strictly from `'self'`; 0 CDN calls | **VERIFIED** | 4 Latin-subset typefaces self-hosted in WOFF2 format (< 65 KB gzipped above-the-fold); strict CSP `font-src 'self'`. |
| **Pickle Deserialization RCE Defense** | Reject `.pkl`, `.bin`, `.pt`, `.pth`; allow only safe `.safetensors`, `.gguf`, `.onnx` | **VERIFIED** | [`packages/core/src/local/models.ts`](file:///home/samyak/Codes/Agents/Abhyas/packages/core/src/local/models.ts) pre-flight validator rejects all pickle extensions before model initialization. |
| **On-Device Audio Isolation** | Microphone VAD processed in local Web Audio thread; 0 cloud audio streaming | **VERIFIED** | Pure client-side RMS voice activity detection ([`vad.ts`](file:///home/samyak/Codes/Agents/Abhyas/packages/core/src/speech/vad.ts)); audio buffers never leave local browser memory. |
| **Credential Safety at Rest** | WebCrypto AES-GCM 256 + PBKDF2 (100k iters); 0 key logging; header auth | **VERIFIED** | [`encryption.ts`](file:///home/samyak/Codes/Agents/Abhyas/packages/core/src/providers/encryption.ts) encrypts keys with user passphrase and random 16-byte salt / 12-byte IV; keys stripped on export; Gemini migrated to `x-goog-api-key` header. |
| **SSRF & Metadata Defense** | Block loopback, RFC 1918 private, link-local, cloud metadata, and IPv4-mapped IPv6 | **VERIFIED** | [`fetcher.py`](file:///home/samyak/Codes/Agents/Abhyas/apps/api/app/pipeline/fetcher.py) SafeFetcher resolves DNS, validates IPs against private/reserved subnets, enforces domain matching, disables automatic redirects, and validates redirect destinations. |
| **Demand Abuse & Cost Protection** | Turnstile anti-bot challenge + sliding rate limiter + daily/monthly budget caps | **VERIFIED** | Cloudflare Turnstile token verification; in-memory sliding-window limiter; [`budget.py`](file:///home/samyak/Codes/Agents/Abhyas/apps/api/app/pipeline/budget.py) enforces daily ($5) and monthly ($100) hard caps with UTC date boundaries. |
| **Constant-Time Admin Auth** | Admin endpoints protected by constant-time secret comparison | **VERIFIED** | [`admin_auth.py`](file:///home/samyak/Codes/Agents/Abhyas/apps/api/app/security/admin_auth.py) uses `secrets.compare_digest` with fail-closed behavior when unconfigured. |
| **Zero PII Demand Registration** | Client request hashing without IP or user identity storage | **VERIFIED** | `client_hash = sha256(ip:token:salt:date)` ensures raw IP addresses and tokens are never persisted in the database. |
| **Strict Content Security Policy** | Defense-in-depth against XSS and unauthorized egress | **VERIFIED** | CSP in `apps/web/index.html` restricts `default-src 'self'`, `object-src 'none'`, `script-src 'self'`, `connect-src 'self' ...` with 0 `dangerouslySetInnerHTML` usages. |

---

## Resolved Security Findings & Hardening

1. **Gemini Secret Key Moved from Query String to Header (RESOLVED):**
   - *Previous Pattern:* `https://generativelanguage.googleapis.com/v1beta/models?key=SECRET_KEY`
   - *Hardened Pattern:* `x-goog-api-key: SECRET_KEY` HTTP header. Stripped `?key=` from all request URLs, eliminating key exposure in proxy access logs, browser history, and error URLs.
   - *Verified by:* [`packages/core/src/providers/key-safety.test.ts`](file:///home/samyak/Codes/Agents/Abhyas/packages/core/src/providers/key-safety.test.ts) and [`tests/p7-exit-gate.test.ts`](file:///home/samyak/Codes/Agents/Abhyas/tests/p7-exit-gate.test.ts).

2. **Budget Boundary Standardized on UTC Time (RESOLVED):**
   - *Previous Pattern:* `date.today()` evaluated in host local timezone, causing budget tracking desynchronization against UTC timestamps.
   - *Hardened Pattern:* `datetime.now(UTC).date()` enforces consistent UTC midnight boundaries regardless of host deployment timezone.
   - *Verified by:* [`apps/api/tests/test_pipeline.py`](file:///home/samyak/Codes/Agents/Abhyas/apps/api/tests/test_pipeline.py) and [`test_security.py`](file:///home/samyak/Codes/Agents/Abhyas/apps/api/tests/test_security.py).

---

## Conclusion
Zero exploitable high-confidence vulnerabilities found in the codebase. All privacy boundaries, network controls, and credential management standards are verified.
