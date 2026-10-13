# Privacy Audit and Egress Architecture — Abhyas

**Document Version:** 1.0.0  
**Last Updated:** 2026-10-13  
**Status:** Canonical Reference (`ADR-005`, `NFR-006`, `NFR-017`, `PRD.md` Section 5)

---

## 1. Core Privacy Architecture & Tenets

Abhyas is architected as a **local-first, zero-telemetry, client-side application**. User privacy is a non-negotiable core principle, not an afterthought.

1. **Zero Telemetry:** The application contains no tracking scripts, analytics pixels, crash telemetry, session recorders, or advertising SDKs.
2. **No User Accounts:** There is no authentication server, no centralized database, and no cloud profile storage. All state lives exclusively inside the user's browser (IndexedDB).
3. **No Intermediate AI Proxy:** All prompt exchanges with cloud AI providers go directly from the user's browser to the provider origin using the user's personal API key (BYOK). Prompts never pass through an intermediary backend server.
4. **Local Text Fallback:** When using local AI models (via WebGPU in-browser or local Ollama servers), zero network calls leave the user's machine during interview sessions.
5. **Self-Hosted Assets:** All fonts, scripts, stylesheets, and icons are served strictly from the application origin (`'self'`). No third-party font CDNs (e.g., Google Fonts) or asset delivery networks are permitted.

---

## 2. Data Classification & Storage Inventory

| Data Element | Sensitivity | Storage Location | Retention / Lifecycle | Destination |
| :--- | :--- | :--- | :--- | :--- |
| **Provider API Keys** | Critical | IndexedDB (`settings`), optional WebCrypto AES-GCM passphrase encryption | Persistent until deleted by user; decrypted only in memory during session | User-selected provider origin only (`connect-src`) |
| **Resumes & Job Descriptions** | High (PII) | IndexedDB (`documents`) | Persistent locally; user can delete at any time | User-selected provider (in structured prompts) |
| **Structured Candidate Profile** | High | IndexedDB (`profiles`) | Persistent locally; exported or purged on demand | User-selected provider (in prompt context) |
| **Spoken Audio (Push-to-Talk)** | High | Browser SpeechRecognition API (ephemeral memory) | Ephemeral buffer; discarded after transcription | Browser speech recognition service |
| **Interview Transcripts & Answers** | High | IndexedDB (`turns`, `sessions`) | Stored in local database; never uploaded to Abhyas servers | User-selected provider (for scoring) |
| **Evaluation Feedback & Scores** | Medium | IndexedDB (`evaluations`, `skillStats`) | Stored in local database | Local client only |
| **Application Settings & Theme** | Low | IndexedDB (`settings`) | Persistent locally | Local client only |

---

## 3. Allowed Outbound Destinations (Allowlist)

In strict accordance with `architecture.md` Section 17, network requests are restricted to the following destinations:

| Destination Origin | Protocol | When Used | Data Transmitted |
| :--- | :--- | :--- | :--- |
| **Own Origin (`'self'`)** | HTTPS | Always | Application bundles, local woff2 fonts, static icons, Web Workers |
| **`https://generativelanguage.googleapis.com`** | HTTPS | When Gemini adapter is active | Prompts (profile context, questions, candidate answers) |
| **`https://api.openai.com`** | HTTPS | When OpenAI adapter is active | Prompts (profile context, questions, candidate answers) |
| **`http://localhost:*`, `http://127.0.0.1:*`** | HTTP | When Ollama / local OpenAI-compatible server is configured | Prompts (local loopback only) |
| **Hugging Face / Model CDN** | HTTPS | P3: Local model download (user-initiated only) | Model weights download (no user data transmitted) |
| **Static Company Pack CDN** | HTTPS | P4: Static company packs | Pack JSON manifest download (no user data transmitted) |
| **`https://www.googleapis.com/calendar/*`** | HTTPS | P6: Optional Google Calendar integration | Calendar events per user-consented OAuth scope |

Any destination not explicitly enumerated above is **unauthorized** and strictly blocked by the Content Security Policy and automated CI network tests (`NFR-017`).

---

## 4. Content Security Policy (CSP) Baseline

To defend against cross-site scripting (XSS), credential extraction, and unauthorized exfiltration, Abhyas enforces the following baseline Content Security Policy in `apps/web`:

```http
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
font-src 'self';
img-src 'self' data:;
worker-src 'self' blob:;
connect-src 'self' https://generativelanguage.googleapis.com https://api.openai.com http://localhost:* http://127.0.0.1:*;
frame-ancestors 'none';
object-src 'none';
base-uri 'self';
form-action 'self';
```

### Directive Justification
- `default-src 'self'`: Prevents loading arbitrary external resources by default.
- `script-src 'self'`: Disallows loading remote JavaScript or untrusted external scripts.
- `font-src 'self'`: Enforces `ADR-020` self-hosted font architecture (blocking font CDNs).
- `connect-src 'self' <allowed-provider-origins>`: Restricts fetch/XHR endpoints strictly to approved AI providers and local development servers.
- `frame-ancestors 'none'`: Prevents clickjacking and framing attacks.
- `object-src 'none'`: Disables legacy plugins (Flash, Java).

---

## 5. Verification & Compliance Controls

1. **Automated CI Network Allowlist Test:** An automated test (`network-allowlist.test.ts`) inspects all outbound request URLs in mock and end-to-end environments, failing builds if any unlisted domain is queried.
2. **License Compliance Check:** Automated dependency auditing blocks copyleft licenses (GPL, AGPL) to preserve permissible commercial and personal use (`ADR-003`).
3. **Redaction Layer:** Error logging boundaries redact API keys, session tokens, and personal details before displaying error diagnostics in the UI (`ADR-005`).
