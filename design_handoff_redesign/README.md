# GuideMe — Design Handoff

A visual redesign of the GuideMe Travel Planner app. This package contains:
- A complete set of high-fidelity HTML mocks for every step of the flow.
- A drop-in stylesheet for the **Booking Checklist** module that matches the rest of the redesign.
- A design-token sheet and a screen-by-screen mapping to the real codebase.

## ⚠️ Read this first

**The HTML files in `mocks/` are design references, not production code.**
They are hand-built static prototypes whose purpose is to specify the intended look, layout, type, spacing, and interaction surface. They are **not** to be copied into the real codebase verbatim. The real app is a vanilla-JS SPA rendered by `public/app.js` against the markup in `public/planner.html`. The task is to **bring that real app to match these mocks** by updating the existing CSS and, where unavoidable, the existing markup — without changing the underlying JS/data model.

**Codebase:** https://github.com/rrichardtang/GuideMe

**Fidelity:** **High-fidelity.** Colors, typography, spacing, radii, shadows, and interaction states are all final. Reproduce pixel-faithfully.

---

## 1. Goal in one paragraph

Replace the current visual language (Inter / Plus Jakarta Sans, generic shadcn-style chrome, sky-blue accent) with the **GuideMe** language used throughout the mocks: **Geist** sans + **Geist Mono** + **Instrument Serif** italic accents, navy `#0A1628` chrome on an ivory `#F4F1EC` paper base, an electric ocean `#2F7DFB` accent, mono‑uppercase eyebrow labels for all metadata, pill buttons, and quietly-shadowed cards. **No app logic changes.** The JS state shape, IDs, classes referenced by handlers, and event flow must stay byte-identical.

---

## 2. What is in this bundle

```
design_handoff_redesign/
├── README.md                ← this file
├── css/
│   └── checklist.css        ← drop-in replacement for tripHealth.css checklist block
└── mocks/
    ├── Landing.html         ← marketing landing
    ├── Setup.html           ← Step 1 — Trip Setup (mock of #step1)
    ├── Planner.html         ← Step 2 — Review Activities (mock of #step2)
    ├── Arrange.html         ← Step 3 — Arrange (mock of #step3)
    ├── Finalize.html        ← Step 4 — Finalize / Trip Health (mock of #step4)
    ├── Itinerary.html       ← Itinerary mode (mock of #itineraryModeView)
    └── styles/
        ├── tokens.css       ← design tokens
        ├── planner.css      ← all in-app chrome + components
        └── landing.css      ← marketing-page-only styles
```

Open any mock in a browser — they work standalone. `Setup.html` also includes a working preview of the redesigned **Booking Checklist** modal (click the `☐ CHECKLIST` button in the dark topbar).

---

## 3. Design tokens

Copy these into `public/styles.css` as a new `:root` block (or merge with the existing one). The names below are the canonical names used throughout the mocks; aliases for current names live at the bottom of `mocks/styles/tokens.css`.

### Surfaces

| Token | Value | Use |
|---|---|---|
| `--ink-abyss` | `#070B12` | deepest anchor (footer blackout) |
| `--ink-900` | `#0A1628` | primary dark — topbar, headers |
| `--ink-800` | `#112240` | hover state on dark |
| `--ink-700` | `#1B2A47` | elevated dark |
| `--ink-600` | `#2B3A5A` | borders on dark |
| `--paper-0` | `#F4F1EC` | page background (ivory) |
| `--paper-1` | `#FAF8F4` | card surface |
| `--paper-2` | `#EEEAE3` | alternating section bg |
| `--paper-3` | `#E2DED6` | muted elevated |

### Text

| Token | Value | Use |
|---|---|---|
| `--text-900` | `#0A1628` | headings |
| `--text-700` | `#1E293B` | body |
| `--text-500` | `#5A6679` | muted / metadata |
| `--text-400` | `#8490A3` | placeholder |

### Hairlines

| Token | Value | Use |
|---|---|---|
| `--hair` | `rgba(10,22,40,.08)` | default border |
| `--hair-strong` | `rgba(10,22,40,.14)` | emphasized border |
| `--hair-dark` | `rgba(244,241,236,.10)` | border on dark surfaces |

### Accent + status

| Token | Value | Use |
|---|---|---|
| `--accent` | `#2F7DFB` | primary action (replaces current `#2A7DE1`) |
| `--accent-hover` | `#1D6DE8` | |
| `--accent-soft` | `#E6EFFE` | tinted bg |
| `--accent-deep` | `#0B4AB8` | accent on light bg text |
| `--ok` | `#1F9D55` | verified / approved (replaces `#16a34a`) |
| `--warn` | `#C08B10` | |
| `--err` | `#C0362C` | |

### Type

| Token | Value |
|---|---|
| `--font-display` | `'Instrument Serif', 'Cormorant Garamond', Georgia, serif` |
| `--font-sans` | `'Geist', 'Inter', 'Söhne', system-ui, -apple-system, sans-serif` |
| `--font-mono` | `'Geist Mono', 'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace` |

Load via Google Fonts:
```html
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&family=Instrument+Serif&display=swap" rel="stylesheet">
```

### Radii

| Token | Value |
|---|---|
| `--r-sm` | `6px` (inputs) |
| `--r-md` | `10px` (items) |
| `--r-lg` | `16px` (cards / containers) |
| `--r-xl` | `24px` (modal) |
| `--r-pill` | `999px` (buttons, chips, badges) |

### Shadows

| Token | Value |
|---|---|
| `--sh-sm` | `0 1px 2px rgba(10,22,40,.04), 0 1px 1px rgba(10,22,40,.03)` |
| `--sh-md` | `0 4px 18px rgba(10,22,40,.06), 0 2px 6px rgba(10,22,40,.04)` |
| `--sh-lg` | `0 24px 60px rgba(10,22,40,.12), 0 8px 20px rgba(10,22,40,.06)` |
| `--sh-glow` | `0 0 0 1px rgba(47,125,251,.25), 0 10px 40px rgba(47,125,251,.18)` |

### Motion

| Token | Value |
|---|---|
| `--ease-out` | `cubic-bezier(.2, .8, .2, 1)` |
| `--ease-inout` | `cubic-bezier(.65, 0, .35, 1)` |
| `--dur-fast` | `140ms` |
| `--dur-med` | `280ms` |
| `--dur-slow` | `520ms` |

The full file with all tokens including a few helpers (`.gm-eyebrow`, `.gm-tag`, `.gm-btn--*`, `.gm-logo`) is in `mocks/styles/tokens.css` — drop it in next to `styles.css` and load it first.

---

## 4. Type & voice rules

These are repeated across every screen — internalize them once.

- **Headings** use Geist 500 with a tight `letter-spacing: -0.02em`. The accent word in a heading is set in **Instrument Serif italic** via `<span class="serif">` — e.g., `Build your trip <span class="serif">leg</span> by leg.` (Setup), `Quick health check, <span class="serif">then you're off.</span>` (Finalize), `Review <span class="serif">Activities</span>` (Planner).
- **Eyebrow labels** (everything that names a metadata field — `TRIP NAME`, `DATES`, `STEP 01 — TRIP SETUP`, `BEFORE YOU GO`, `MADRID 04/24`, etc.) use Geist Mono 10.5px, `letter-spacing: 0.14em`, uppercase, color `--text-500`. This is the `.gm-eyebrow` class.
- **Tabular numbers** — all dates, times, prices, references, counts — use Geist Mono with `font-variant-numeric: tabular-nums`.
- **Body** is Geist 400/500 at 13.5–14px, `letter-spacing: -0.005em`.
- **No emoji.** No drop shadows on text. No gradient text. No icon decorations on headings.

---

## 5. Screen-by-screen mapping

For each row, the **Mock** is the file in `mocks/` to match pixel-faithfully; the **Real** is the file/region in the GuideMe repo that needs to be updated to look like it.

| Mock | Real (in `public/`) | Notes |
|---|---|---|
| `Landing.html` | `index.html` + `styles.css` | Marketing page. New hero with Instrument Serif italic accents. Three feature blocks, logo marquee, "Four steps, one unhurried afternoon" flow strip, CTA. |
| `Setup.html` | `planner.html` `#step1` + `app.js` (city rendering) + `styles.css` (`.city-row*`, `.setup-*`) | Replaces the existing `.city-row` accordion with the new `.city` accordion (collapse chevron, tabs for Stay / Arrival / Departure / Notes, mono date pill, trip-arc visualization at top). Same data, same fields. |
| `Planner.html` | `planner.html` `#step2` + `app.js` (`renderActivityCards`) + `styles.css` (`.activity-card*`) | New activity card with serif italic in title block, monospace metadata footer, flippable back-side map view. Approve/Skip CTA pair retained. |
| `Arrange.html` | `planner.html` `#step3` + `app.js` (`renderDayColumns` etc.) + `styles.css` (`.day-col*`, `.placed-card*`) | Day-column timeline with new ruler, placed cards in muted activity colors, time-edit popup. |
| `Finalize.html` | `planner.html` `#step4` + `app.js` (`renderTripHealth`) + `tripHealth.css` | New trip health hero with ring gauge and the issues list. The "Issues" rows map 1:1 to the existing flagged-issue iteration. |
| `Itinerary.html` | `planner.html` `#itineraryModeView` + `app.js` (`renderItineraryMode`) + `styles.css` (`.itinerary-*`) | Day-by-day stops view. Each city = `<section class="city-section">`; each stop = `.stop` row with `.stop__kind`, `.stop__title`, `.stop__meta`, `.stop__cost`. |

---

## 6. Booking Checklist module — drop-in CSS

This is the only piece of the redesign that is actually packaged as ready-to-merge code rather than mock-to-recreate, because **the markup the JS produces is already exactly what the mocks render against**. Every selector in `css/checklist.css` matches the class names emitted by `renderChecklistModal()`, `renderChecklistContainer()`, and `renderChecklistItemExpanded()` in `public/app.js`.

### How to apply

1. **Append the contents of `css/checklist.css` to `public/tripHealth.css`** (or replace the existing checklist block in that file — everything from the `/* ── Checklist modal card ── */` comment onward).
2. Make sure the token names referenced (`--paper-1`, `--accent`, `--hair`, etc.) resolve. If `public/styles.css` still uses the older token names (`--base-light`, `--secondary-light`, `--secondary`), either:
   - **Preferred**: replace the `:root` block in `styles.css` with the one in §3, **and** add the legacy aliases that file already has (`--bg`, `--surface`, `--card`, etc.) so other selectors keep working.
   - **Minimum**: add aliases at the top of `tripHealth.css`:
     ```css
     :root {
       --paper-0: var(--base-light, #F4F1EC);
       --paper-1: var(--base-light, #FAF8F4);
       --paper-2: #EEEAE3;
       --hair: rgba(10,22,40,.08);
       --hair-strong: rgba(10,22,40,.14);
       --text-900: var(--heading, #0A1628);
       --text-700: var(--text, #1E293B);
       --text-500: var(--text-muted, #5A6679);
       --text-400: #8490A3;
       --accent-soft: #E6EFFE;
       --accent-deep: #0B4AB8;
       --ok: #1F9D55;
       --err: #C0362C;
       --r-sm: 6px; --r-md: 10px; --r-lg: 16px; --r-xl: 24px; --r-pill: 999px;
       --sh-sm: 0 1px 2px rgba(10,22,40,.04), 0 1px 1px rgba(10,22,40,.03);
       --sh-md: 0 4px 18px rgba(10,22,40,.06), 0 2px 6px rgba(10,22,40,.04);
       --sh-lg: 0 24px 60px rgba(10,22,40,.12), 0 8px 20px rgba(10,22,40,.06);
       --dur-fast: 140ms;
       --ease-out: cubic-bezier(.2, .8, .2, 1);
     }
     ```
3. **Do not touch `public/app.js` or `public/js/bookingChecklist.js`.** The render functions, the `state.bookingChecklist` shape, the `data-cl-*` hooks, the click handlers — all unchanged.
4. **Header heading** — if you want the serif italic on the modal title, change just this one line of markup in `public/planner.html`:
   ```html
   <!-- before -->
   <h3>Booking Checklist</h3>
   <!-- after -->
   <h3>Booking <span class="serif">Checklist</span></h3>
   ```
   And add this rule alongside the others:
   ```css
   .checklist-modal-header h3 .serif {
     font-family: var(--font-display);
     font-style: italic;
     font-weight: 400;
   }
   ```

### What was redesigned (everything the JS emits)

| Surface | Before | After |
|---|---|---|
| Modal card | rounded 24px, drops in centered | unchanged structure; new ivory bg, subtle 1px hair border, soft `--sh-lg`, header bottom-hair |
| Header | "Booking Checklist" sans 700 | sans 500, tight letter-spacing; icon buttons now circular `--hair` chip on hover |
| Search pill | rounded full, Inter | rounded pill, `--paper-0` bg, mono input, accent focus ring |
| Container header | sans 700 with hover accent-soft tint | sans 500, paper-2 hover, mono price + mono badge count |
| Container body | gray-ish bg | transparent over paper-1 card with subtle inner padding |
| Subsection title (`Booking Required` etc.) | uppercase sans 700 small | mono uppercase eyebrow (10.5px, 0.14em) |
| Item row | white card with green-flush on verified | paper-0 card; verified state is a tinted `--ok`-rgba bg + strikethrough name + green-toned price |
| Checkbox | rounded square, lime-green check | rounded square 22px, `--ok` fill on check, focus ring uses accent |
| Ticket toggle | small square button, blue | square `--paper-2` chip, accent when on, strikethrough when off |
| Field label | sans 700 uppercase 12px | mono uppercase eyebrow 10.5px, 0.14em |
| Inputs | rounded, generic | 38px height, `--r-sm`, paper-0 bg, accent focus ring; dates/times use mono tabular |
| Toggle group (one-way/round-trip) | flat segmented bar | pill toggle, active gets accent fill + small accent glow |
| Price input | rounded with `$` prefix | same idea, mono input, accent focus ring on wrap |
| More details disclosure | sans, plain | mono uppercase eyebrow caret toggle |
| Add Item button | flat blue text | dashed pill, accent on hover, `--accent-soft` fill |
| Totals block | left-aligned | right-aligned, mono tabular |

Everything that was already animated (item flash, transitions on hover) is preserved at the same durations.

### Search-result badges

`renderChecklistModal` emits `.cl-badge--transportation`, `.cl-badge--accommodation`, `.cl-badge--activity`. These are now small mono uppercase chips tinted with the accent / `--ok` / warn ochre tones respectively. No JS change needed.

### Mobile

Existing responsive break at 767px is preserved as a 720px break in the new CSS (matching the rest of the redesign). Subsections collapse to single-column form rows, the modal goes full-width with a 14px gutter.

---

## 7. What NOT to change

- `public/js/bookingChecklist.js` — pure data normalization, no rendering.
- The render-function names, signatures, or output structure in `app.js` (`renderChecklistModal`, `renderChecklistContainer`, `renderChecklistItemExpanded`, `groupChecklist`, `checklistItemSortKey`, `sortChecklistByDateAsc`, `formatChecklistDate`, `truncateLocation`, `buildChecklistFromState`, `syncItemFromExpanded`).
- `state.bookingChecklist` shape and item field names (`type`, `verified`, `budgetUsd`, `referenceNum`, `notes`, `bookingNotRequired`, `transportScope`, `departureDate`/`Time`, etc.). The CSS reads no data — it only styles class names.
- Click handlers and event delegation keyed on `data-cl-*` attributes (`data-cl-check`, `data-cl-collapse-row`, `data-cl-item`, `data-cl-group`, `data-cl-toggle-container`, `data-cl-booking-toggle`, `data-cl-delete`, `data-cl-add`, `data-cl-more`, `data-cl-toggle`, `data-cl`).
- The `#checklistModal` / `#bookingChecklist` DOM IDs and `overlayManager.open('checklistModal')` flow.
- Phosphor icons usage — `.ph-bold` weight is what the CSS expects. Don't swap icon sets.

---

## 8. Suggested order of operations

If a developer wants to land this incrementally rather than as a single big PR:

1. **Tokens** — drop the new `:root` block into `public/styles.css`; keep legacy aliases. Visual diff should be near-zero at this point.
2. **Type** — replace Inter/Plus Jakarta Sans imports with Geist + Geist Mono + Instrument Serif. Nothing else changes. Take a screenshot of every step before/after.
3. **Topbar** — re-skin `.topbar`, the mode toggle, the trip-health badge, and the checklist button. Matches `mocks/Setup.html` topbar.
4. **Checklist module** — apply `css/checklist.css` (this is fully drop-in once tokens are in place).
5. **Step panels** — Setup → Planner → Arrange → Finalize → Itinerary, in that order. Each step is one mock file to match.
6. **Landing** — replace `index.html` styles last.

Each step is independently shippable and visually coherent.

---

## 9. Open questions for the developer

- **Header copy** — the mocks use phrasing like "Build your trip _leg_ by leg.", "Quick health check, _then you're off._", etc. Use those exactly; they are intentional and tested for tone.
- **Icon weight** — the mocks use Phosphor **bold** at small sizes (12–18px) consistently. Don't mix in `ph-regular` or `ph-fill` weights.
- **Approve/Skip CTAs** — the redesigned activity card keeps both buttons; the primary green from current design is gone — Approve is now ink-on-paper (`--ink-900` bg) or accent depending on context. See `Planner.html` mock.

---

## 10. Verification

Open `mocks/Setup.html` in a browser and click the topbar `☐ CHECKLIST` button to see the redesigned modal with sample data. Compare with what your local dev build shows after applying `css/checklist.css`. They should be visually identical aside from real trip data vs. mock data.

For the rest of the screens, open the matching mock in one tab and the real app in another at the same viewport width (1280px is a good default), and step through the flow.
