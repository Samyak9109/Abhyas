# Design — Abhyas

| Field | Value |
| --- | --- |
| Document | `design.md` (authority level 3 of 4) |
| Version | 0.2.2 |
| Last updated | 2026-10-13 |
| Governs | Visual identity, design system, interaction rules, page and screen specifications |
| Governed by | `PRD.md`, then `architecture.md` |
| Companion docs | `phases.md` (page build schedule) |
| Visual source of truth | Design canvas "Abhyas — Design Direction v1": https://claude.ai/artifact/WvYUtLtBJ9YazKC3GPc4DC (boards **Landing page** = PG-01 and **AI setup** = PG-09) |

Status labels follow `PRD.md` section 0.3. The owner approved the v1 visual direction on 2026-10-13, so everything this document takes from the canvas is `[DECIDED]`: the retro-pixel look, the palette family, the four typefaces, the pixel mascot and the layout language. Details the canvas does not show are `[DEFAULT]` and follow the same language.

---

## 1. Purpose and how to use this document

Use it to build or review any page or component.

1. Find the page in section 8 by its `PG-##` id (the inventory lives in `PRD.md` section 3A).
2. Use only the tokens (section 4) and components (section 6). Do not invent one-off styles.
3. For PG-01 and PG-09, match the canvas boards. For other pages, apply the same language using the rules here.
4. Implement every required state (section 7.4).
5. Check accessibility (section 10), trust patterns (section 11) and the known deviations (section 14).

If something needed is missing here, add it here first (smallest reasonable addition), then build it. If the canvas and this document disagree, this document wins; section 14 lists the known differences.

---

## 2. Design direction and principles

### 2.1 Direction `[DECIDED]`
**Retro terminal meets paper collage.** A serious practice tool wearing a playful skin: pixel display type, monospaced labels, a near-black "ink" ground with warm cream "paper" bands, one hot orange accent, hairline borders, square corners, dotted-grid texture and a pixel-art monitor-head mascot. Inspired by the supplied references (retro landing page, dark product mockups and two editorial agency layouts), without copying any of them.

### 2.2 Two registers
| Register | Where | Character |
| --- | --- | --- |
| **Expressive** | Public site (PG-01 to PG-08), setup pages, empty states | Big pixel headlines, mascot, collage, stickers, ticker, bracket labels |
| **Calm** | Live interview (PG-12), Results (PG-13), dashboards | Same tokens and fonts, far less decoration: no ticker, no stickers, no background texture behind content, restrained motion |

Practice is stressful. The expressive skin must never add pressure inside the interview.

### 2.3 Principles
1. **Honest.** Scores are guidance; always show the evidence behind a number. Never invent statistics, testimonials or user counts. The "facts" band shows only verifiable facts.
2. **Private and visible.** Say what stays on the device and what leaves it, in plain words, where it matters.
3. **Guided first run, efficient later.** Setup is a short, forgiving three-step flow; returning users reach Start in two taps.
4. **Voice and text are equals.** Everything possible by voice is possible by typing. Subtitles are always available.
5. **Encouraging, not gamified.** Habits are supported without shame, noisy rewards or streak anxiety.
6. **Fail softly.** Every error says what happened, why, and what to do next, and never loses the user's work.
7. **Accessible by default.** WCAG 2.2 AA is a baseline, not a polish step. Style never overrides legibility.

---

## 3. Voice, tone and content style

- **Brand voice:** direct, warm, a little playful on public pages; plain and supportive inside the product.
- **Headings:** short, uppercase in the display font, often ending with the cursor motif `_` (for example "Built for real progress_"). The `_` is decorative and must be hidden from assistive technology.
- **Labels:** bracket labels in mono, for example `{ Why choose us }`.
- **Plain words** on setup screens. Explain unavoidable terms once ("API key: a password that lets this app use an AI service you control").
- **Honesty phrases:** "based on 3 answers", "not enough answers yet", "guidance, not a verdict".
- **Low scores:** say what to improve and how; never shame. Labels: Strong, Developing, Needs work.
- **Buttons:** specific verbs ("Start practice", "Test connection"), uppercase mono styling does the shouting, so write the copy in sentence case in code.
- **Errors:** what happened, likely cause, what you can do. No blame; codes only under "Details".
- **No fake proof:** no invented counts, ratings, user quotes or logos. Missing facts become placeholders in design files, never made-up numbers.
- **No model names in marketing copy or fixed UI** (they change); model lists come from the provider (AI-009).
- **Numbers:** show units; scores 0 to 100; time mm:ss. **Capitalization:** sentence case in running text.
- **Language:** English in v1; all strings externalized (NFR-019).

---

## 4. Foundations (tokens)

Components reference **semantic tokens** only. Raw values appear only in the token definition file. Implementation: CSS custom properties set per theme with a `data-theme` attribute, mapped into Tailwind. Contrast ratios below were computed for these exact values; re-verify after any change (NFR-011).

### 4.1 Typefaces `[DECIDED]`: locked, do not change or substitute

| Role | Typeface | Weights used | Used for |
| --- | --- | --- | --- |
| Display | **Pixelify Sans** | 500, 700 | Large headings, big numerals, step titles. Never for body, labels, forms or anything under 28 px. |
| Body | **Instrument Sans** | 400, 500, 600 | Paragraphs, card text, list items, form values in prose areas |
| Mono | **JetBrains Mono** | 400, 500, 700 | Labels, buttons, nav, chips, code, data, timers, inputs for keys |
| Hand note | **Caveat** | 600 | Marketing hand-written side notes only, decorative, never essential information |

Rules:
- These four families, in these roles, are the entire type system. A designer or agent may not add, swap or re-assign a typeface without an ADR and owner approval.
- **Self-host the font files** (woff2, Latin subset, `font-display: swap`). **No runtime requests to any font CDN.** The design canvas loads fonts from a CDN only as a preview convenience. A CDN request would send the user's IP to a third party and break NFR-017 and the CSP.
- Fallback stacks: Display `'Pixelify Sans', ui-monospace, monospace`; Body `'Instrument Sans', system-ui, sans-serif`; Mono `'JetBrains Mono', ui-monospace, monospace`; Hand `'Caveat', cursive`.
- Verify and ship each typeface's license file in `THIRD_PARTY_LICENSES` when bundling (all four are published under open font licenses; confirm at bundling time).
- Measure the font payload in M0.2 and record it against the budget in NFR-025. Load Caveat only on public pages that use it. Preload only the display and body files used above the fold.

### 4.2 Color tokens `[DECIDED]` (palette family) / `[DEFAULT]` (exact semantic values beyond the canvas)

Two app themes plus fixed "paper" bands on public pages.

| Token | Dark "Ink" (default) | Light "Paper" | Use |
| --- | --- | --- | --- |
| `--bg` | `#121110` | `#EFE9DC` | App background |
| `--surface` | `#1C1A17` | `#F7F3EA` | Cards, panels |
| `--surface-2` | `#26231F` | `#E6DFCF` | Nested areas, hover fills |
| `--line` | `#3A352F` | `#CFC6B4` | Decorative dividers only |
| `--line-strong` | `#7D7468` | `#7A7266` | Control borders, inputs, outlines (3:1 or better on every surface) |
| `--text` | `#EFE9DC` | `#121110` | Primary text |
| `--text-muted` | `#A9A296` | `#5A5348` | Secondary text |
| `--accent` | `#FF6A2B` | `#FF6A2B` | Fills: primary buttons, highlights, markers |
| `--accent-text` | `#FF6A2B` | `#A83409` | Orange used as text or thin lines on the theme background |
| `--on-accent` | `#121110` | `#121110` | Text on accent fills |
| `--focus` | `#FF6A2B` | `#A83409` | Focus ring |
| `--success` | `#7BD88F` | `#1F6B33` | Positive state text and icons |
| `--warning` | `#F2B33D` | `#8A5300` | Caution; "Needs work" band |
| `--danger` | `#FF7A6B` | `#A4160A` | Errors, destructive |
| `--info` | `#6DB7FF` | `#0B5FA5` | Neutral information |
| `--cat-technical` | `#FF6A2B` | `#A83409` | Skill category: technical |
| `--cat-behavioral` | `#5EC8B6` | `#0F6B5C` | Skill category: behavioral |
| `--cat-delivery` | `#F5D547` | `#7A5A00` | Skill category: delivery |

**Public-page paper bands (fixed in both themes):** paper `#EFE9DC`, on-paper text `#121110`, on-paper muted `#5A5348`, on-paper accent text `#A83409`.

**Measured contrast (initial values):**
- Dark: text 12.9 to 15.6; muted 6.2 to 7.5; accent text 5.5 to 6.6; status colors 6.1 to 10.8; category colors 5.5 to 13.0; ink on accent 6.6; `--line-strong` 3.4 to 4.9 on bg, surface and surface-2.
- Light: text 14.2 to 17.0; muted 5.7 to 6.9; accent text 5.0 to 6.0; status colors 4.8 to 7.0; category colors 4.8 to 6.0; ink on accent 6.6; `--line-strong` 3.6 to 4.3.
- The orange fill on the light background is only about 2.4:1, so on Paper every accent-filled control also carries a 1 px `--text` border, and its label (ink on orange, 6.6) provides the readable contrast.

Rules:
- Text at least 4.5:1 (3:1 for large text); graphics and control edges at least 3:1.
- Never convey meaning by color alone; pair with text, icon or pattern. Category colors always come with an icon and label.
- Orange as body-size text on Paper must use `--accent-text`, never `--accent`.
- Theme follows the system by default; override in Settings. Public pages keep their ink and paper bands in both themes.
- Focus ring: 2 px `--focus` outline, 3 px offset, on every focusable element.
- The canvas "accent" tweak offers alternates (`#FF8A3D`, `#F5B700`) as exploration only. The shipped accent is `#FF6A2B` unless the owner decides otherwise.

### 4.3 Typography roles (sizes are desktop; see 5.4 for small screens)

| Role | Font | Size / line height | Notes |
| --- | --- | --- | --- |
| Hero display | Pixelify 700, uppercase | 92 / 0.94 | Public hero only; accent word in `--accent-text` |
| Section heading | Pixelify 700, uppercase | 52 / 1.0 | Ends with decorative `_` |
| App page title | Pixelify 700, uppercase | 40 to 60 / 1.0 | Setup and empty pages; calm pages use 32 to 40 |
| Big numeral | Pixelify 700 | 64 / 1.0 | Fact boxes, score numerals |
| Card title | Instrument Sans 600 | 16 to 20 / 1.3 | |
| Body | Instrument Sans 400 | 16 / 1.6 to 1.7 | Reading text never below 16 px |
| Small | Instrument Sans 400 | 14 / 1.6 | Helper and secondary text; minimum 13 |
| Label | JetBrains Mono 500, uppercase, tracking 0.12 to 0.16em | 12 | Bracket labels, chips, nav; **minimum 12 px** |
| Button | JetBrains Mono 700, uppercase, tracking 0.1em | 13 (14 on hero CTA) | |
| Data and code | JetBrains Mono 400 | 13 to 14 | Keys, timers, transcripts metadata |
| Hand note | Caveat 600 | 26 | Decorative; rotate about -5 degrees; hide from assistive tech or duplicate its message in normal text |

Pixelify Sans is hard to read when small. It is display-only (28 px and up). All interactive labels and any text a user must read carefully use Instrument Sans or JetBrains Mono.

### 4.4 Spacing, shape, borders, shadows
- Spacing base 4 px: `--space-1 4`, `-2 8`, `-3 12`, `-4 16`, `-5 20`, `-6 24`, `-8 32`, `-12 48`, `-16 64`, `-24 96`.
- Page gutters: 64 px desktop, 32 px tablet, 20 px phone. Section vertical padding: 96 px desktop, 56 px phone.
- **Corners are square** (radius 0) for almost everything: buttons, cards, inputs, chips, boxes. Exceptions: switches (full pill), device mockups (14 px laptop, 30 px phone), the orange circle behind the mascot, radio dots.
- Borders: 1 px hairlines in `--line` (decorative) or `--line-strong` (controls). Section dividers: 1 px `--line`.
- Shadows: avoid soft shadows, except device mockups (`0 18px 40px rgba(18,17,16,0.35)`). Stickers and floating tags use a **hard offset shadow** `4px 4px 0 #121110`.
- No gradients, glass or blur effects.

### 4.5 Motion
- Durations `--dur-fast 120ms`, `--dur-base 200ms`, `--dur-slow 320ms`; ease-out.
- Motion is functional (state change, focus, progress) plus two allowed expressive loops on public pages: the blinking cursor after headings and an optional slow ticker. Both are static under reduced-motion settings.
- The mascot animates between whole-pixel frames (steps, no easing) at no more than 4 frames per second.
- Never animate scores, charts or numbers to build suspense.

### 4.6 Iconography
Outline icons, 24 px grid, 1.8 px stroke, drawn square-ish to match the pixel language. Monogram tiles (a letter or `{ }` in a bordered 44 px square, display font) stand in for provider logos so the app never ships third-party brand marks. Icons always pair with a label or accessible name.

### 4.7 Graphic language (use sparingly, expressive register only)
1. **Dotted grid:** radial-gradient dots every 14 px, 1.5 px, in `--surface-2` on ink.
2. **Pixel dissolve:** a scatter of 16 to 32 px squares (greys and accent) breaking away from an image or mascot.
3. **Orange disc** behind the mascot.
4. **Sticky note:** cream card, mono uppercase text, rotated about 3 degrees, hard shadow.
5. **Code box:** 1 px accent border, mono, lines like `> prepare()`.
6. **Bracket labels** `{ Label }`.
7. **Ticker band:** full-width accent strip, mono bold uppercase tracking 0.16em, items separated by small squares. Decorative, `aria-hidden`.
8. **Fact boxes:** 1 px accent border, display numeral, mono caption.
9. **Cursor motif** `_` after headings.
No photography or stock imagery. Any imagery is illustration, pixel art or UI.

### 4.8 The mascot `[DECIDED]` (name `[OPEN]`, working name "Pixel")
A retro monitor-head figure in a blazer. It is the product's interviewer representation (resolves the open question about avatar versus waveform) and is never a realistic human.

- **Construction:** drawn in SVG on an 8 px pixel grid, 3 px ink outlines. Monitor body `#CFC8B8`, screen `#0E0D0C`, neck `#8E887B`, blazer `#6F6A60`, shirt `#E8E1D2`; facial pixels in `--accent`. Reference artwork: the Landing board.
- **Faces (screen content):**

| State | Face | Motion | Text label (always present) |
| --- | --- | --- | --- |
| Idle / greeting | Tall eyes (8x16), smile (6 pixels) | none | "Ready" |
| Speaking | Eyes as idle; mouth alternates smile and open | 2-frame loop, 4 fps max | "Speaking" |
| Listening | Eyes slightly taller, small flat mouth | none, or a single blink | "Listening" |
| Thinking | Three dots in place of the mouth | dots appear in sequence | "Thinking" |
| Paused | Flat line mouth, eyes half-height | none | "Paused" |
| Problem | Eyes as dashes, small neutral mouth (never alarming) | none | "Something went wrong" |

- **Sizes:** hero (about 400 px wide, full bust), interview card (head only, 96 to 160 px), compact indicator (a 44 px square tile with three vertical bars) for phones and tight spaces.
- **Accessibility:** the artwork has a text alternative in public use ("Pixel mascot: a retro computer monitor with a smiling face") and is treated as decorative inside the interview, where the adjacent state label carries the meaning. Under reduced motion, all faces are static.
- Do not add the mascot to error dialogs for sensitive failures (data loss); use plain text there.

---

## 5. Layout and responsive behavior

### 5.1 Breakpoints
| Breakpoint | Width | Layout |
| --- | --- | --- |
| Base | 360 and up | Single column; bottom tab bar in the app; menu button on public pages |
| `sm` | 640 and up | Wider gutters |
| `md` | 768 and up | Two-column where useful |
| `lg` | 1024 and up | Sidebar in the app; full public nav |
| `xl` | 1280 and up | Content max width about 1280 px on public pages, 1100 px in the app |

### 5.2 Public pages
- Full-width bands alternating ink and paper; content constrained to the max width; 1 px divider between bands.
- Header: wordmark with the four-square glyph, nav links in mono uppercase, "100% private" badge. On phones nav collapses to a menu button opening a full-screen list with large targets.
- Footer: wordmark, links (Privacy, Open source, MIT license, Source code), short tagline.

### 5.3 App shell
- Desktop: left sidebar (Home, New session, Skills, History, Settings) 112 to 160 px, content area, optional right rail for transcripts on the interview page.
- Mobile: bottom tab bar (Home, Practice, Skills, History, More); `[OPEN]` whether Home or Skills leads.
- The live interview page is a focus view: navigation hidden, a clear Pause and End.
- Setup pages (PG-09 to PG-11) use the minimal header with the stepper and no sidebar.

### 5.4 Small-screen rules
- Display sizes scale with `clamp()`: hero 44 to 92 px, section headings 32 to 52 px, numerals 44 to 64 px. Never let a pixel heading overflow; wrap words, keep `overflow-wrap: anywhere` as a safety net.
- Multi-column grids collapse: 4 columns to 2 to 1; 3 to 1; split layouts stack with text first, imagery after.
- Device mockups: show the phone only on phones.
- Touch targets at least 44 by 44 px, 8 px apart. Respect safe areas.
- No horizontal page scroll; wide tables scroll inside their own box.

---

## 6. Components

Every component ships with default, hover, focus-visible, active, disabled, loading and error states where relevant. Values are from the approved canvas unless noted.

### 6.1 Core controls
- **Button primary:** `--accent` fill, `--on-accent` text, JetBrains Mono 700 uppercase, tracking 0.1em, 13 px (14 px on hero), padding 16 x 26 (hero 20 x 30), square corners, optional trailing arrow icon. Hover: slightly brighter fill and an offset hard shadow; Active: shift 2 px; Disabled: `--surface-2` fill, `--text-muted` text, 1 px `--line`, not-allowed cursor, adjacent text explains why. Loading: spinner replaces the arrow, width unchanged. On Paper, add a 1 px `--text` border.
- **Button secondary:** transparent, 1 px `--line-strong`, text `--text`; hover border `--accent-text`.
- **Button ghost:** text only with underline on hover; **danger:** secondary with `--danger` text and border.
- **Text link:** `--text`, underlined; arrows allowed.
- **Input and textarea:** label above (mono 12 uppercase), field on `--bg` with 1 px `--line-strong`, padding 14 x 16, mono 14 for keys and data, Instrument Sans for prose areas, helper text below (13 px muted), error text with icon replaces helper, counters where relevant.
- **Secret input:** masked by default, "show" icon button (44 px square), paste-friendly, no browser autofill.
- **Switch:** 52 x 30 pill, 22 px knob, `role="switch"` on a real button, visible state text nearby.
- **Radio card (provider choice):** full-width button with `role="radio"`; 1 px `--line-strong`; selected state: 1 px `--accent-text` border and a mono "Selected" tag; contains a 44 px monogram tile, title (16 px 600), one-line description (13 px muted). A dashed, non-interactive variant shows "coming soon" items.
- **Select, checkbox, radio group, tabs, segmented control:** native semantics, square styling, arrow-key support, selected state not by color alone.
- **Dialog:** focus trapped and restored; 1 px border, `--surface`; destructive bulk deletion requires a typed phrase.
- **Toast and banner:** toast for brief confirmation only (never the sole carrier of an error); banner for persistent status with an action.
- **Progress:** determinate bar (square, 8 px, accent fill) with percentage and label; indeterminate only with explanatory text.
- **Skeleton, tooltip:** skeleton matches final layout; tooltip is supplementary and keyboard reachable.

### 6.2 Navigation and structure
- **Stepper (setup):** numbered 26 px squares with 1 px borders, current step in accent with `aria-current="step"`, 40 px connectors; labels in mono 12 uppercase.
- **Sidebar item:** mono 12 uppercase, 8 px padding; selected: accent text and `--surface-2` fill.
- **Footer bar (setup):** left status chip ("1 / 3 Test your connection to continue"), right primary action (disabled until valid).
- **Badge "100% private":** 1 px `--line-strong` outline, lock icon, mono 12 uppercase. Only shown where true.

### 6.3 Content components
- **Feature card:** 60 px square icon box with 1 px accent border, mono title, 14 px muted text.
- **Fact box:** 1 px accent border, display numeral 64, mono caption muted. Contains only verifiable facts.
- **Step item:** 1 px left border, number chip (ink fill, cream text, mono 12; current step accent fill), mono title, 14 px muted text.
- **FAQ item:** implemented as a disclosure (`details` and `summary`); top 1 px `--line`; mono 15 question, body 15 muted. The canvas shows items expanded for review.
- **Callout (info):** `--bg` fill, 1 px `--line`, info icon, 13 px text.
- **Sticky note, code box, ticker, bracket label:** as in 4.7.
- **Device mockup frame:** 3 px ink border, radius 14 (laptop) or 30 (phone), shown on public pages only, content drawn from real UI components.

### 6.4 Product components
- **Provider card / status:** name, status (Not set up, Connected, Problem), model in use, Test and Edit actions.
- **Model card:** name, size, speed rating, fit for this device (Good, Tight, Too large), license link, Download, Pause, Delete, storage used; "Unverified" tag until the sanity test passes.
- **Company badge:** name and status (Ready, Requested ✓, Researching, Not available, Stale) with last-verified date; opens the "Company context used" panel with sources.
- **Interviewer indicator:** the mascot or compact tile with a state label (section 4.8).
- **Subtitle block:** two lanes, speaker label, interim text muted italic until final, size S, M, L.
- **Push-to-talk button:** large; idle, listening (pulse and elapsed time), processing, error; visible shortcut hint.
- **Timer:** mono, mm:ss; announces only at meaningful thresholds.
- **Score chip:** number, label (Strong, Developing, Needs work) and confidence marker; never a bare number.
- **Confidence marker:** three steps (Low, Medium, High) with text; low confidence softened and labeled "Based on N answers".
- **Skill chip, streak chip:** with category icon; streak never alarming when broken.
- **Transcript row, chart frame, empty state, error state:** as defined in section 7 patterns; chart frames always include a title, one-sentence takeaway, table alternative and an evidence note.

---

## 7. Interaction patterns

### 7.1 Voice interaction (FR-009, FR-010)
- **Talk control:** tap to start and tap to stop by default (works on touch); desktop also supports holding Space. States: idle, listening, processing, review.
- **Listening:** the mascot shows the Listening face; elapsed time visible; interim text appears live in the user's subtitle lane.
- **Review step:** after stopping, the transcript appears in an editable field with "Submit" and "Record again". The user is never scored on text they have not had the chance to fix.
- **Interviewer speech:** question text streams as it is spoken; speech starts at sentence boundaries; Pause, Repeat and Mute are always reachable.
- **Interrupting:** starting to talk stops interviewer speech (automatic end-of-speech detection is a later phase).
- **Permission denied:** a panel with steps to re-enable the microphone and a "Switch to typing" button; the session continues.
- **Unsupported browser:** voice controls are absent, not disabled; typing is the default and a one-line note explains why.
- **Audio start on mobile:** first audio needs a visible tap; "Start interview" doubles as that gesture.

### 7.2 Subtitles
On by default; toggle available; size S, M, L and a high-contrast background option. Both speakers in separate labeled lanes; text identical to what is spoken. Never hidden when audio is off; the question text always stays visible.

### 7.3 Streaming text
Tokens stream with a subtle caret; layout reserves space to avoid shift. Auto-scroll follows the stream unless the user scrolls up, then "Jump to latest" appears. Cancel is always available while generating. Screen readers are not flooded: announce completed sentences, not tokens.

### 7.4 Required states for every page
Default, loading, empty, error, offline, permission denied (where relevant), partial or degraded (for example "company data unavailable, using a general session"), and success confirmation. A page without all applicable states is not done.

### 7.5 Loading thresholds
Under 300 ms: no indicator. 300 ms to 3 s: spinner or skeleton. Over 3 s: add a text explanation. Over 10 s: offer Cancel and an alternative path. Model downloads and loads always show determinate progress and what it means ("one-time download, saved on this device").

### 7.6 Confirmations and destructive actions
- End a session early: dialog with "Save partial results", "Discard", "Keep practicing".
- Delete one session: simple confirm.
- Delete all data: typed confirmation phrase, states it cannot be undone and recommends exporting first.
- Remove a provider key: simple confirm; explains sessions will need a provider.

### 7.7 Keyboard shortcuts (interview page; can be disabled in Settings)
Space (talk), Enter (submit, with the modifier the app defines), Esc (pause menu), R (repeat), H (hint), S (skip). Shortcuts never fire while typing in a field and are listed in a visible help popover.

### 7.8 Notifications
No push notifications and no sounds by default. Reminders come from calendar events (FR-027). In-app banners only for status that needs action.

---

## 8. Pages and screens (by `PG-##`)

IDs and purposes are defined in `PRD.md` section 3A; build order is in `phases.md` section 6A. "Canvas" means the approved design canvas. Layouts below are descriptions, not pixel specs; apply the tokens and components above. Every page needs the states in 7.4.

### Public site (expressive register, static, prerendered, SEO per NFR-012)

**PG-01 Landing** (canvas: Landing page)
- Bands in order: header; hero (headline with accent word "AI_", one-sentence promise, primary CTA "Start practice", hand note "No sign up. Your data. Your device.", mascot collage with orange disc, pixel dissolve, sticky note, code box); ticker; "Why choose us" (bracket label, heading, four feature cards: Fast start, Safe space, Track progress, Private and local); "The experience" on paper (laptop and phone mockups drawn from real UI, "Works offline once a local model is downloaded" tag, honest feature list, boxed link to the key and local model options); "The facts" (fact boxes: 0 accounts needed, 0 resumes sent to our servers, MIT license); "How it works" on paper (4 steps); FAQ (disclosures); closing CTA with "Practice today. Be ready tomorrow_"; footer.
- Content rules: no invented statistics, testimonials or user counts; the facts band uses only verifiable facts; no model names; no "View demo" until a demo exists (`[OPEN]`).
- Mobile: nav in a menu; hero text first, then mascot (min height 420); grids collapse; phone mockup only.
- States: static page; the CTA leads to PG-09 (or PG-14 for returning users, detected from local storage).

**PG-02 Privacy**
- Plain-language explanation plus the table of what leaves the device per configuration (the table in section 11 / `docs/privacy-audit.md`), network destinations list, data storage and deletion, voice-recognition note, company-lookup note. Mono headings, paper or ink band, no decoration beyond bracket labels.

**PG-03 Open source and license**
- MIT license text and plain summary, source link, how to contribute, trademark note (forks rename), third-party licenses link, security contact.

**PG-04 Key guide**
- A short illustrated stepper per provider: where to create a key, what to copy, what a free tier may or may not include (link to the provider for current terms), how to paste and test. Pixel-style simple illustrations, large screenshots avoided (they go stale); each step 1 to 2 sentences.

**PG-05 Troubleshooting and compatibility**
- Browser support matrix, common errors mapped to causes and fixes (invalid key, quota, blocked by provider, microphone, storage), copyable diagnostics instructions. Searchable list; disclosure items.

**PG-06 Local models guide** (P3)
- Who can run local models (PC only, WebGPU), recommended tiers, download sizes, how the speed test works, Ollama and local-server setup including the cross-origin note, text-only explanation.

**PG-07 Roadmap and changelog** (Could)
- Phases in plain words, current status, release notes. No dates promised.

**PG-08 Not-found, unsupported-browser and offline pages**
- Mascot in "Problem" or "Ready" face with plain text, one primary action (Go home, Use text mode, Retry), diagnostics link where relevant.

### App: setup flow (expressive-lite)

**PG-09 AI setup** (canvas: AI setup)
- Header with wordmark and stepper (AI setup, Profile, Start). Two columns: left "Step 1 of 3", title "Choose your AI source_", intro, radio cards (Gemini, OpenAI, other compatible service, dashed "More providers: coming later"), guide link; right configuration panel for the selected provider: monogram tile and name, key field with show toggle and note "Stays in this browser. Sent only to the provider you choose.", primary "Test connection", link "Get a free API key" (to PG-04), "OR" divider, switch "Use a local model (PC only)" with offline and text-only note, info callout about phones.
- Footer bar: status chip, primary "Next: add your profile" disabled until the test passes.
- States: not tested, testing, success (shows model picker and a green confirmation with text), each classified error, offline, local mode unavailable (phone or no WebGPU, with explanation), model list loading.

**PG-10 Profile and documents** (FR-002 to FR-004)
- Stepper step 2. Resume upload (drop zone, accepted types, size note) or paste; job description paste; experience level as five selectable cards with one-line descriptions; target role field. After upload: extracted text preview with edit, and the structured profile summary (skills, projects) with edit.
- States: parsing, parse failure with paste fallback, scanned-PDF notice, role-only mode, large job description truncation notice.

**PG-11 Session setup with company choice** (FR-006, FR-025)
- Stepper step 3. Summary card of profile; company search with status badges and a visible "Skip: general session"; interview type, difficulty (defaults from level), interviewer style, length, voice or text; estimated cost and time; primary "Start interview".
- Company states: Ready (verified date, "Company context used" link), Requested ✓, Researching, Not available (Request or general session), Stale. Phase P1 shows only the general option.

### App: core pages (calm register)

**PG-12 Live interview** (FR-008 to FR-011)
- Focus view. Top bar: progress "Question 3 of 10", timer, Pause menu. Center: interviewer card (mascot head with state label, current question), subtitle lanes, answer area with push-to-talk and the editable transcript; secondary controls: Repeat, Hint, Skip, End. Optional right rail: live transcript (desktop).
- Text-only version: chat-style thread, streaming interviewer text, answer textarea with word count, per-question countdown, no audio controls.
- Drill mode: same layout, a "Skill drill" tag and shorter progress.
- Mobile: compact indicator tile, large push-to-talk, subtitles above controls.
- States: thinking, speaking, listening, review transcript, evaluating, error recoverable (retry, switch to typing, save partial), microphone denied, offline, provider quota. No scores shown during the interview unless live hints are on.

**PG-13 Results** (FR-013)
- Overall score chip with level-appropriate framing; top three fixes first; criterion bars; per-answer list with expandable feedback and "stronger answer"; "Company context used" panel; transcript tab. Actions: Retry weakest question, Practice this skill, Finish.
- States: partial session, unscored turns, text-only (no delivery metrics, no penalty message). Feedback copy leads with what to do, then why.

**PG-14 Home** (FR-018)
- Primary "Start session"; today's drill card (weakest skill); streak chip; recent sessions; interview-date countdown if set. First-time state: guided start with the mascot and one action. P1 shows only start and recent sessions.

**PG-15 Skills dashboard** (FR-014, FR-015)
- Chart frame with the skill chart by category, weakest and strongest lists with confidence, trends, stale skills, "View as table". Tapping a skill opens PG-16. States: zero data, one session.

**PG-16 Skill practice** (FR-016)
- Skill picker grouped by category, format (Quick-fire, Deep-dive), "Fix my weakest", expected duration. Starts PG-12 in drill mode.

**PG-17 History and session detail** (FR-019)
- List with date, type, company, overall score, modality; filters; detail with transcript, scores and delete. States: empty, many sessions (virtualized), corrupt session notice.

**PG-18 Settings** (FR-020, FR-021, FR-030)
- Sections: Providers and keys, Voice and subtitles, Appearance (theme, subtitle size), Data (export, import, delete all), Privacy summary, Diagnostics (copyable redacted report), About (license, version, source, trademark note). States: in-memory storage banner, storage usage.

**PG-19 Model manager** (FR-022 to FR-024)
- Device summary (speed test), recommended model cards, installed models with storage meter, "Add custom model" flow (engine, identifier, pre-flight results, download, sanity-test badge). States: WebGPU unavailable, downloading with pause and resume, failed, storage nearly full, persistent storage not granted.

**PG-20 Company directory and detail** (FR-025)
- Search and list with status badges; detail shows sourced fields with confidence labels, dates, links, "Report a problem". States: no match, stale, low coverage.

**PG-21 Report and request dialogs** (FR-026, FR-029)
- Request research (company name and optional domain; says only the name is sent), report incorrect info (field, short reason; no personal data sent). Confirmation states; rate-limit and backend-down fallbacks (prefilled issue link).

**PG-22 Schedule** (FR-027)
- Interview date and cadence, generated plan preview, export `.ics`, optional "Connect Google Calendar". States: no date, OAuth denied, success.

**PG-23 Review queue** (FR-028)
- Daily set of missed questions with due dates and a short drill start. State: nothing due.

---

## 9. Data visualization guidelines

- Every chart has a title, a one-sentence takeaway, an accessible data table alternative and a note on how many answers support it.
- **Skill chart:** bar chart by default, radar optional on wide screens; at most 10 axes visible (group the rest). Prefer horizontal bars on narrow screens.
- **Colors:** `--cat-*` tokens plus an icon per category; graphics at least 3:1; labels in JetBrains Mono 12 px minimum.
- **Confidence encoding:** lower confidence uses lighter fill, dashed outline and a text label; never color alone.
- **Trend lines:** show points; display only with enough data (at least 10 answers per skill); one skill at a time by default.
- **Score bands (initial, tunable):** 75 to 100 Strong, 50 to 74 Developing, below 50 Needs work. "Needs work" uses `--warning`, not `--danger`.
- **Streak calendar:** rest days are a distinct neutral state; no negative styling for missed days.
- Numbers use tabular figures and fixed decimals. Big score numerals may use the display font at 28 px and up only.
- Chart animation is off under reduced motion; otherwise at most `--dur-base`.

---

## 10. Accessibility requirements (NFR-011)

- **Standard:** WCAG 2.2 AA across all pages, both themes, and the public paper and ink bands.
- **Keyboard:** every action reachable and operable; logical order; visible focus ring; no traps; dialogs trap and restore focus.
- **Screen readers:** meaningful roles and names; headings in order; status via polite live regions. During interviews announce the question once when complete and announce state changes (listening, processing); never announce streaming tokens or per-second timers.
- **Decorative elements are hidden from assistive tech:** the `_` cursor motif, ticker, dotted grid, pixel dissolve, sticky-note duplicates and hand notes (or their message is also present as ordinary text, as with "No sign up. Your data. Your device.").
- **Pixel type legibility:** the display font only at 28 px and up, never for form fields, buttons, long text or small labels; keep headings short; wrap, never truncate.
- **Minimum sizes:** body 16 px; secondary 13 to 14 px; mono labels 12 px minimum.
- **Captions:** subtitles for all spoken content; transcripts after sessions.
- **Alternatives to voice:** every voice action has a typed equivalent.
- **Motion:** respect reduced motion; the mascot, cursor and ticker become static; no auto-playing animation beyond those.
- **Color and contrast:** as in 4.2; test with color-blindness simulation; category colors always paired with icons and labels.
- **Text scaling:** supports 200% zoom without clipping; no text in images; the mascot is the only pixel artwork and has alt text where it carries meaning.
- **Forms:** visible labels, errors in text linked to fields, required fields marked in text.
- **Time limits:** per-question timers are optional and adjustable before and during a session.
- **Testing:** automated axe checks per page and theme in CI; manual keyboard and screen reader pass on the interview flow before each release.

---

## 11. Privacy and trust patterns (FR-021, NFR-017)

- Say it where it matters, in one sentence, then link to details (PG-02).
- **Setup:** summary of what stays on the device and what the chosen provider receives.
- **Before first voice use:** one-time notice that some browsers process speech in their own cloud service.
- **Company feature:** only the company name is sent to the project's server.
- **Local mode:** nothing leaves the device after the model download.
- **Fonts and assets:** all self-hosted; the site makes no third-party requests during normal use.
- **Keys:** masked after saving; "Remove key" is one tap; passphrase encryption offered with a plain explanation.
- **Open source:** visible link to the source in the header area of About, the footer and PG-03.
- **Never:** hide data flows behind consent walls, use dark patterns, show unverifiable claims, or phrase notices as legal boilerplate.

---

## 12. Microcopy library (starting set)

| Situation | Copy |
| --- | --- |
| Privacy summary | "Your resume, answers and progress stay in this browser. Your AI provider receives what it needs to run the interview." |
| Key field note | "Stays in this browser. Sent only to the provider you choose." |
| Local mode | "Everything runs on this computer. Nothing is sent anywhere after the download." |
| Local mode, phone | "On a phone, local models are not available. Add an API key to practice on your phone." |
| Voice notice | "Some browsers send your speech to their own service to turn it into text. You can type instead." |
| Company data | "We only send the company name to find public information." |
| Invalid key | "That key was not accepted. Check it was copied fully, or create a new one." |
| Quota | "This key has reached its usage limit. Wait a while, or use a different key or model." |
| Blocked by provider | "This service does not allow direct use from a browser. Try a different provider or see the troubleshooting guide." |
| Mic denied | "The microphone is blocked. You can allow it in your browser settings, or type your answers instead." |
| Low confidence | "Based on 2 answers. Practice a few more for a clearer picture." |
| Score framing | "This is guidance to help you practice, not a prediction of hiring decisions." |
| Company not ready | "We have not researched this company yet. You can start a general session now." |
| Requested | "Requested. Check back later." |
| Empty skills | "Complete a session to see your strengths and what to work on." |
| Unscored answer | "We could not score this answer. It does not count toward your skills." |
| Delete all | "This removes everything stored in this browser. Export a backup first if you want to keep it." |
| Streak rest day | "Rest day. Your streak is safe." |
| Setup footer (disabled) | "Test your connection to continue" |

---

## 13. Rules for AI coding agents building UI

- Use tokens and components from this document; never hard-code colors, spacing or font sizes.
- **Fonts are locked** (4.1). Do not add, swap or reassign typefaces. Self-host; never load fonts from a CDN.
- Build all states in 7.4 for every page before calling it done.
- Do not add animation, sound, confetti, leaderboards, gradients, glass effects, rounded corners beyond those listed, or photography.
- Never display a score without its label and confidence.
- Never invent statistics, testimonials, logos or model names. Use verified facts or placeholders.
- Never remove subtitles, text alternatives or visible focus.
- Keep copy in the externalized string files and follow section 3.
- Do not introduce new third-party UI libraries without an ADR.
- Verify contrast and run accessibility checks whenever tokens change.
- If a design is ambiguous, implement the simplest version consistent with these rules and note it in the pull request.
- Generate no unused components, styles, tokens, icons, assets or font weights, and build only the pages and states the current milestone needs (`architecture.md` 24.6).
- Reuse existing components before writing new ones; read only the page and component sections a task references.
- A generic front-end or design skill may help with implementation but never overrides this document's fonts, tokens, copy rules or page specifications.

---

## 14. Known deviations: canvas versus this specification (spec wins)

| Canvas shows | Specification says | Why |
| --- | --- | --- |
| Fonts loaded from a font CDN | Self-hosted files, no CDN | Privacy, CSP, NFR-017 |
| Control borders `#6B6359` | `--line-strong` `#7D7468` in dark | The canvas value is 2.9:1 on surface; 3:1 required |
| Some 11 px mono chips ("Selected", "Soon") | 12 px minimum | Legibility |
| Gemini card text "free keys available" | Neutral wording and a link to current terms | Provider terms change |
| Static FAQ text expanded | Disclosure (`details`) | Accessibility and length |
| Colors written as raw hex values in the markup | Semantic tokens only | Maintainability and theming |
| Setup screen fixed at 1440 x 900 | Fluid with the breakpoints in 5.1 | Responsive requirement |
| No Welcome screen | Landing (PG-01) replaces it | Simplicity |
| Hero uses a hand note, ticker, sticker | Allowed on public pages only; off in the calm register | Section 2.2 |

---

## 15. Open design decisions

1. Mascot name and a final wordmark and logo (the four-square glyph is the working mark).
2. Whether Home or Skills leads the mobile tab bar.
3. Whether the live interview shows the full mascot bust or head only on desktop (default: head only).
4. Illustration style for the key guide steps.
5. Final accent alternatives (default stays `#FF6A2B`).
6. Whether to add a demo experience for the landing page (needs a product decision; none exists today).
7. Sound design: none planned.

---

## 16. Change Log
| Date | Version | Change |
| --- | --- | --- |
| 2026-10-12 | 0.1.0 | Initial design system |
| 2026-10-13 | 0.2.0 | Rebuilt around the approved retro-pixel direction: locked typefaces, new tokens and themes, mascot, page specifications by PG id, known deviations |
| 2026-10-13 | 0.2.1 | Wordmark text is now "Abhyas"; canvas renamed |
| 2026-10-13 | 0.2.2 | UI agent rules extended: no unused artifacts, reuse first, skills never override this document |
