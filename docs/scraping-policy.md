# Scraping and Web Retrieval Policy — Abhyas Company Research Service

**Version:** 1.0.0  
**Last Updated:** 2026-10-19  
**Status:** Canonical Policy (`FR-026`, `ADR-009`, `phases.md` M5.6)

---

## 1. Scope & Objective

Abhyas operates a bounded, privacy-conscious backend research service designed to gather verifiable, public factual information about employers (such as tech stack, interview processes, core values, and product lines) to calibrate realistic practice interview simulations.

This document outlines our ethical, legal, and operational commitments regarding web retrieval and automated discovery.

---

## 2. Polite Retrieval & Rate Limits

1. **User-Agent Identification:**
   All HTTP requests made by the Abhyas research pipeline clearly identify the bot, its purpose, and contact information:
   ```http
   User-Agent: AbhyasResearchBot/1.0 (+https://abhyas.app/bot; research@abhyas.app)
   ```
2. **Rate Limiting & Politeness:**
   - The fetcher strictly limits request frequency to a maximum of **1 request per second** per origin domain.
   - Per-job retrieval is capped at **10 pages maximum**.
   - Maximum content size per page is restricted to **500 KB** to prevent network or host memory exhaustion.
3. **Robots Exclusion Standard (`robots.txt`):**
   - The crawler honors `robots.txt` directives per origin. Disallowed paths are never retrieved.
4. **No Paywalls or Login Bypass:**
   - The crawler accesses only publicly accessible, unauthenticated web pages.
   - It does not bypass paywalls, CAPTCHAs, or authentication barriers.
   - User reviews, employer review sites (e.g. Glassdoor, Blind), and social profile data are explicitly out of scope and rejected (`PRD.md` Section 10).

---

## 3. Permitted Target Origins

To safeguard against Server-Side Request Forgery (SSRF) and data pollution:
- Requests are strictly bounded to the candidate company's verified canonical domain and authorized subdomains (e.g. `*.acme.com`).
- Approved external platforms are restricted to recognized public developer portals:
  - Official engineering blogs (Medium, Substack, GitHub organization pages)
  - Public documentation and Wikipedia entries for high-level company overviews
- Requests to private subnets, cloud metadata services (e.g. `169.254.169.254`), loopbacks (`127.0.0.1`, `::1`), and non-HTTP protocols are blocked at the socket level.

---

## 4. Text Extraction & Sanitization

1. **Stripped Code and Scripts:**
   - All HTML scripts (`<script>`), styles (`<style>`), hidden elements (`display:none`, `aria-hidden`), iframes, and media objects are stripped prior to extraction.
2. **Injection Scanning:**
   - Extracted text undergoes automated scanning for adversarial prompt injection (e.g., instructions attempting to subvert downstream AI evaluation).
   - Injected substrings are replaced with `[REDACTED_UNTRUSTED_CONTENT]`.
3. **Evidence Requirement:**
   - Every claim in an extracted pack must reference a specific source URL, page title, and retrieval timestamp. Claims lacking verifiable public sources are omitted.

---

## 5. Takedown & Inaccuracy Inquiries

We respect site owners and copyright holders. If you are an employer or webmaster who wishes to update, correct, or exclude pages from Abhyas research:
- **Email:** `research@abhyas.app`
- **In-App:** Use the "Report inaccurate data" dialog in the Abhyas company directory.
- **Repository Issues:** Open a report at `https://github.com/abhyas/abhyas/issues`.

Requests to remove or correct pages are processed within 48 business hours.
