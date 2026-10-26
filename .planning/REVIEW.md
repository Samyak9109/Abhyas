# Code Review: Abhyas Core & Backend Services

Comprehensive code review across privacy boundaries, cryptographic safety, AI streaming adapters, state machines, storage/backup migrations, backend research pipeline, and frontend user flows.

## Summary

- **Total Findings:** 15
- **Critical Severity [CRITICAL]:** 7
- **Warning Severity [WARNING]:** 6
- **Informational Severity [INFO]:** 2

---

## Critical Findings [CRITICAL]

### 1. Voice Mode Follow-Up Question Deadlock
- **File & Lines:** [`packages/core/src/interview/session-runner.ts:355-358`](file:///home/samyak/Codes/Agents/Abhyas/packages/core/src/interview/session-runner.ts#L355-L358)
- **Issue Description:** When `decideFollowUp` decides a follow-up question is warranted, it dispatches `{ type: "FOLLOW_UP", question: followUpQ }`. This transitions the state machine into `"ask"` status. Line 356 then conditionally dispatches `QUESTION_READY` only for text mode:
  ```typescript
  if (plan.inputMode === "text") {
    await this.dispatch({ type: "QUESTION_READY", question: followUpQ });
  }
  ```
  However, in voice mode (`plan.inputMode === "voice"`), no audio playback is started and `QUESTION_READY` is never dispatched anywhere else.
- **Risk:** In voice mode, when a follow-up question is generated, the interview hangs indefinitely in the `"ask"` state displaying "Asking question...". The candidate can neither speak (VAD is off) nor advance, completely deadlocking the voice interview session.
- **Concrete Fix:** Trigger TTS playback or dispatch `QUESTION_READY` once TTS audio generation starts / completes, ensuring voice mode proceeds to `"listen"`:
  ```typescript
  if (plan.inputMode === "text") {
    await this.dispatch({ type: "QUESTION_READY", question: followUpQ });
  } else {
    // In voice mode, initiate TTS if configured or transition to QUESTION_READY
    await this.dispatch({ type: "QUESTION_READY", question: followUpQ });
  }
  ```

---

### 2. SafeFetcher SSRF via In-Flight HTTP Redirects
- **File & Lines:** [`apps/api/app/pipeline/fetcher.py:178-195`](file:///home/samyak/Codes/Agents/Abhyas/apps/api/app/pipeline/fetcher.py#L178-L195)
- **Issue Description:** `SafeFetcher.fetch()` configures `httpx.AsyncClient(follow_redirects=True)`. While `validate_url(url)` checks the initial target domain, any in-flight redirect (301/302/307/308) is automatically followed by HTTPX *before* `validate_url(final_url)` is evaluated on line 189:
  ```python
  async with httpx.AsyncClient(
      timeout=self.timeout_s,
      follow_redirects=True,
      headers={"User-Agent": self.user_agent},
  ) as client:
      resp = await client.get(url)
  ```
- **Risk:** An attacker-controlled external seed URL can redirect to link-local or loopback addresses (`http://169.254.169.254/latest/meta-data/` on cloud providers, `http://127.0.0.1:8000/api/admin`), circumventing the initial private IP blocklist and causing Server-Side Request Forgery (SSRF) and metadata exposure.
- **Concrete Fix:** Set `follow_redirects=False` in `httpx.AsyncClient`. Intercept redirect status codes (3xx), validate each `Location` header URL and resolved IP against `validate_url()` and `_is_private_ip()`, and loop up to a fixed maximum redirect limit (e.g., 3 hops).

---

### 3. SafeFetcher Unbounded Memory Consumption Bomb (DoS)
- **File & Lines:** [`apps/api/app/pipeline/fetcher.py:191-193`](file:///home/samyak/Codes/Agents/Abhyas/apps/api/app/pipeline/fetcher.py#L191-L193)
- **Issue Description:** `fetch()` uses `resp = await client.get(url)` followed by `content_bytes = resp.content[:MAX_PAGE_SIZE_BYTES]`. Accessing `resp.content` forces HTTPX to read and decompress the entire HTTP response payload into memory before slicing it.
- **Risk:** A target host serving a multi-gigabyte payload or a gzip decompression bomb (e.g., 10MB compressed into 10GB raw) causes the backend worker to exhaust RAM and terminate with `MemoryError` or get OOM-killed, denying service to the research pipeline.
- **Concrete Fix:** Stream the response body and terminate reads as soon as `MAX_PAGE_SIZE_BYTES` is exceeded:
  ```python
  async with client.stream("GET", url) as resp:
      if resp.status_code >= 400:
          return None
      chunks = []
      total = 0
      async for chunk in resp.aiter_bytes():
          chunks.append(chunk)
          total += len(chunk)
          if total >= MAX_PAGE_SIZE_BYTES:
              break
      content_bytes = b"".join(chunks)[:MAX_PAGE_SIZE_BYTES]
  ```

---

### 4. API Key Erasure on Merge Backup Import
- **File & Lines:** [`packages/core/src/storage/import-service.ts:165-171`](file:///home/samyak/Codes/Agents/Abhyas/packages/core/src/storage/import-service.ts#L165-L171) & [`packages/core/src/storage/export-format.ts:70-74`](file:///home/samyak/Codes/Agents/Abhyas/packages/core/src/storage/export-format.ts#L70-L74)
- **Issue Description:** By default, backup exports set `options.includeKeys = false`, exporting provider rows with `key: undefined` and `encryptedKey: undefined`. When a user subsequently restores or imports a backup file with `mode: "merge"`, `importBackup` runs:
  ```typescript
  for (const record of data.tables[table]) {
    await this.storage.put(table, record);
  }
  ```
  This unconditionally replaces existing IndexedDB provider records with the imported records.
- **Risk:** Restoring a standard keyless backup wipes all active configured AI provider credentials and encrypted keys on the local device, requiring the user to re-enter all provider credentials.
- **Concrete Fix:** In `merge` mode for the `providers` table, inspect if the existing row contains a configured key or `encryptedKey`. Preserve existing keys when the imported row has `undefined` key fields:
  ```typescript
  if (table === "providers" && mode === "merge") {
    const existing = await this.storage.get("providers", record.id);
    if (existing && !record.encryptedKey && existing.encryptedKey) {
      record.encryptedKey = existing.encryptedKey;
      record.key = existing.key;
    }
  }
  ```

---

### 5. Gated Model Token Exfiltration in Default Exports
- **File & Lines:** [`packages/core/src/storage/export-format.ts:70-74`](file:///home/samyak/Codes/Agents/Abhyas/packages/core/src/storage/export-format.ts#L70-L74) & [`packages/core/src/schemas/storage-rows.schema.ts:112`](file:///home/samyak/Codes/Agents/Abhyas/packages/core/src/schemas/storage-rows.schema.ts#L112)
- **Issue Description:** `buildExport` sanitizes sensitive fields by stripping keys solely from the `providers` table:
  ```typescript
  if (table === "providers" && !options.includeKeys) {
    record = { ...record, key: undefined, encryptedKey: undefined };
  }
  ```
  However, `models.gatedToken` in `storage-rows.schema.ts` stores HuggingFace access tokens for gated local/remote models. It is retained in full inside `tables.models`.
- **Risk:** Users sharing exported backups or moving them between devices inadvertently leak their HuggingFace personal access tokens in plaintext JSON even though `includeKeys: false` was selected.
- **Concrete Fix:** Strip `gatedToken` from records under the `models` table whenever `!options.includeKeys`:
  ```typescript
  if (table === "models" && !options.includeKeys) {
    record = { ...record, gatedToken: undefined };
  }
  ```

---

### 6. AttributeError Crash in QueueManager Dispatch
- **File & Lines:** [`apps/api/app/pipeline/queue.py:159, 165, 216`](file:///home/samyak/Codes/Agents/Abhyas/apps/api/app/pipeline/queue.py#L159) & [`apps/api/app/pipeline/types.py:41-43`](file:///home/samyak/Codes/Agents/Abhyas/apps/api/app/pipeline/types.py#L41-L43)
- **Issue Description:** `QueueManager` in `queue.py` checks state attributes:
  ```python
  if state.cost_cents >= self.budget.max_cost_cents_per_company:
  ...
  return state.coverage_score >= 0.8
  ```
  However, in `app/pipeline/types.py`, the fields in `ResearchState` dataclass are defined as:
  ```python
  cost_estimate_cents: int = 0
  coverage: float = 0.0
  ```
- **Risk:** Invoking `queue_manager.can_dispatch()` or checking completion immediately raises an unhandled `AttributeError: 'ResearchState' object has no attribute 'cost_cents'`, crashing background workers during pack generation.
- **Concrete Fix:** Update `queue.py` attribute accesses to match `ResearchState` definition:
  - Replace `state.cost_cents` with `state.cost_estimate_cents`
  - Replace `state.coverage_score` with `state.coverage`

---

### 7. ResearchExtractor Fallback Bypasses Real AI Provider
- **File & Lines:** [`apps/api/app/pipeline/extractor.py:111-157`](file:///home/samyak/Codes/Agents/Abhyas/apps/api/app/pipeline/extractor.py#L111-L157)
- **Issue Description:** In `extract_from_documents(company, docs, mock_output=None)`, if `mock_output` is `None`, the function falls through directly to the static regex-based heuristic extractor (`_rule_based_fallback`), without making any API call to an AI provider or LLM client even if `project_ai_api_key` and provider configurations are present in settings.
- **Risk:** Company research generation in production yields low-quality, template-based questions and cultural summaries without utilizing actual LLM extraction, defeating the pipeline's purpose.
- **Concrete Fix:** Wire the extraction step to the configured LLM client (e.g. Gemini / OpenAI / Anthropic) when `mock_output is None` and an API key is available, reserving `_rule_based_fallback` solely for network failure or offline mode.

---

## Warning Findings [WARNING]

### 8. HTMLTextExtractor Premature Depth Decrement
- **File & Lines:** [`apps/api/app/pipeline/fetcher.py:112-118`](file:///home/samyak/Codes/Agents/Abhyas/apps/api/app/pipeline/fetcher.py#L112-L118)
- **Issue Description:** `HTMLTextExtractor.handle_endtag(tag)` decrements `self._ignored_depth` on any closing tag when depth is positive:
  ```python
  def handle_endtag(self, tag: str) -> None:
      if self._ignored_depth > 0:
          self._ignored_depth -= 1
          return
  ```
- **Risk:** If an ignored container (`<nav>`, `<script>`, `<style>`) contains nested tags (e.g., `<nav><ul><li><a href="#">Link</a></li></ul></nav>`), the first closing tag (`</a>`) decrements `_ignored_depth` to 0. Remaining navigation or script text is incorrectly processed as visible body text, polluting extraction context.
- **Concrete Fix:** Track ignored tag names on a stack or only decrement when `tag` matches the specific opening tag that triggered ignore mode:
  ```python
  def handle_starttag(self, tag, attrs):
      if tag in self.IGNORED_TAGS:
          self._ignored_stack.append(tag)
  def handle_endtag(self, tag):
      if self._ignored_stack and self._ignored_stack[-1] == tag:
          self._ignored_stack.pop()
  ```

---

### 9. Prompt Injection Delimiter Gap in Profile Claims
- **File & Lines:** [`packages/core/src/interview/context-builder.ts:208, 223`](file:///home/samyak/Codes/Agents/Abhyas/packages/core/src/interview/context-builder.ts#L208)
- **Issue Description:** While resume text, job descriptions, and user answers are sanitized via `sanitizePromptData()` and enclosed in protective XML blocks (`<resume>`, `<job_description>`, `<transcript>`), candidate profile highlights and claims in `buildContext()` are concatenated directly into the system prompt:
  ```typescript
  if (profile?.highlights?.length) {
    lines.push("Candidate highlights to probe:");
    for (const h of profile.highlights) {
      lines.push(`- ${h.topic}: ${h.claim} (confidence ${h.confidence})`);
    }
  }
  ```
- **Risk:** If a parsed resume contained an adversarial prompt injection in a project title or claim, it persists into the profile store and gets reinjected without sanitation into subsequent interview turns.
- **Concrete Fix:** Wrap the profile block inside `<candidate_profile>` tags and pass each claim through `sanitizePromptData()` before appending.

---

### 10. Streaming Reader Missing Abort Checks in Anthropic & HF Adapters
- **File & Lines:** [`packages/core/src/providers/anthropic-adapter.ts:228`](file:///home/samyak/Codes/Agents/Abhyas/packages/core/src/providers/anthropic-adapter.ts#L228) & [`packages/core/src/providers/huggingface-adapter.ts:204`](file:///home/samyak/Codes/Agents/Abhyas/packages/core/src/providers/huggingface-adapter.ts#L204)
- **Issue Description:** In `anthropic-adapter.ts` and `huggingface-adapter.ts`, the streaming loop reads chunks via:
  ```typescript
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    ...
  }
  ```
  Unlike `gemini-adapter.ts` and `openai-compatible-adapter.ts`, there is no `if (opts.signal?.aborted) { await reader.cancel(); break; }` check at the start of each read iteration.
- **Risk:** When a candidate aborts an interview turn or cancels question generation, HTTP streaming continues consuming bandwidth and device CPU in the background until the remote stream completes.
- **Concrete Fix:** Add `if (opts.signal?.aborted) { await reader.cancel(); break; }` at the top of the while-loop in both adapters.

---

### 11. In-Memory Rate Limiter Memory Leak & Proxy Collapsing
- **File & Lines:** [`apps/api/app/security/rate_limit.py:14, 46`](file:///home/samyak/Codes/Agents/Abhyas/apps/api/app/security/rate_limit.py#L14)
- **Issue Description:** `RateLimiter` stores timestamps in `_history: dict[str, list[float]]`. Keys are never evicted even when request timestamps age out. Furthermore, `client_ip = request.client.host if request.client else "unknown"` ignores reverse proxy headers (`X-Forwarded-For`).
- **Risk:** 
  1. Unbounded dictionary growth over prolonged backend uptime leads to memory exhaustion.
  2. When deployed behind a reverse proxy (e.g. Cloudflare or NGINX), all client requests share the single proxy IP, causing collective rate limiting across distinct users.
- **Concrete Fix:** Evict empty or expired IP buckets periodically. When `TRUSTED_PROXIES` is configured, extract the true client IP from validated proxy headers.

---

### 12. Pipeline Validator Accepts Unvetted Arbitrary URLs
- **File & Lines:** [`apps/api/app/pipeline/validator.py:91`](file:///home/samyak/Codes/Agents/Abhyas/apps/api/app/pipeline/validator.py#L91)
- **Issue Description:** `validate_pack()` checks evidence sources:
  ```python
  if url in valid_urls or url.startswith(("http://", "https://")):
      valid_sources.append(source)
  ```
  This treats any string starting with `http://` or `https://` as a valid evidenced source, even if it was never fetched or verified by the crawler.
- **Risk:** Hallucinated URLs generated by an LLM pass pack validation as "evidenced claims", violating the core pipeline guarantee that all facts trace back to fetched documents.
- **Concrete Fix:** Enforce `if url in valid_urls:` strictly, rejecting unverified external URLs.

---

### 13. ResultsScreen Grounded Rewrite Drops Active Provider
- **File & Lines:** [`apps/web/src/screens/ResultsScreen.tsx:97-108`](file:///home/samyak/Codes/Agents/Abhyas/apps/web/src/screens/ResultsScreen.tsx#L97-L108)
- **Issue Description:** In `handleLoadRewrite`, `generateGroundedRewrite` is invoked as:
  ```typescript
  const result = await generateGroundedRewrite({
    question: q.text,
    transcript: answer.transcript,
    starCritique: crit.starFeedback,
    improvements: crit.improvements,
  });
  ```
  The optional `provider` argument is omitted.
- **Risk:** `generateGroundedRewrite` falls back to its static template generator rather than leveraging the candidate's active AI provider, yielding generic rather than tailored STAR rewrites.
- **Concrete Fix:** Retrieve the active configured provider from the storage service and supply it in the options object passed to `generateGroundedRewrite`.

---

## Informational Findings [INFO]

### 14. Calendar Export Midnight Rollover Date Malformation
- **File & Lines:** [`packages/core/src/schedule/ics.ts:67-71`](file:///home/samyak/Codes/Agents/Abhyas/packages/core/src/schedule/ics.ts#L67-L71) & [`packages/core/src/schedule/google-calendar.ts:77-80`](file:///home/samyak/Codes/Agents/Abhyas/packages/core/src/schedule/google-calendar.ts#L77-L80)
- **Issue Description:** `calculateSessionTimes` computes end hour as `startHour + Math.floor(totalMinutes / 60)`. When a session starts late in the evening (e.g. 23:45 for 30 minutes), `endHour` becomes 24, producing an invalid RFC 5545 timestamp `241500Z` or an end time on the same date earlier than start time.
- **Risk:** Calendar applications (Google Calendar, Apple Calendar, Outlook) reject or fail to render late-night practice reminders.
- **Concrete Fix:** Use `Date` object millisecond arithmetic (`endDate = new Date(startDate.getTime() + durationMinutes * 60000)`) to ensure date rollover is accurately reflected in `DTEND`.

---

### 15. CORS Wildcard Allowed Headers with Credentials Enabled
- **File & Lines:** [`apps/api/app/main.py:40-44`](file:///home/samyak/Codes/Agents/Abhyas/apps/api/app/main.py#L40-L44)
- **Issue Description:** `CORSMiddleware` specifies `allow_credentials=True` along with `allow_headers=["*"]`. Under strict browser implementations and certain CORS fetch modes, combining credentials with wildcard header allowances causes preflight rejections.
- **Risk:** API preflight requests may fail in specific user agents when custom headers like `Authorization` are transmitted.
- **Concrete Fix:** Replace `allow_headers=["*"]` with an explicit list: `allow_headers=["Content-Type", "Authorization", "Accept", "X-Admin-Key"]`.

---

## Systemic Patterns & Recommendations

1. **State Machine & Modality Symmetry:** Ensure event transitions (like `QUESTION_READY` and `LISTEN_START`) have unambiguous triggers across both text and voice modes in `SessionRunner`.
2. **Egress & Ingestion Defenses:** Network fetchers in backend pipelines must follow strict zero-trust principles: disable automatic redirect chasing to protect against SSRF, stream incoming responses to guard against memory bombs, and strictly enforce domain allowlists.
3. **Data Export/Import Roundtrip Hygiene:** Maintain privacy parity between storage schemas and backup serializers. If tokens or API keys exist in secondary tables (like `models.gatedToken`), they must be scrubbed on export, and merge imports must avoid clobbering existing sensitive credentials with null/undefined values.
