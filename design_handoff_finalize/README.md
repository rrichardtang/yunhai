# Handoff: GuideMe — Finalize (Step 04)

This bundle specifies the redesigned **Finalize** screen for the GuideMe trip planner — the final step in the four-step planning flow (Setup → Review → Arrange → **Finalize**).

## ⚠️ Read this first

**`mocks/Finalize.html` is a design reference, not production code.** It is a hand-built static HTML/CSS prototype whose job is to specify the intended layout, type, spacing, and interaction surface for the screen. **Do not ship it.** The task is to **recreate this design inside the real GuideMe app** using the codebase's existing patterns (vanilla JS SPA rendered by `public/app.js` against `public/planner.html`) — or, if you are implementing in a different environment (React, Vue, native), to translate it faithfully into that environment's idioms while preserving the visual specification exactly.

**Fidelity: High.** Every color, font, spacing, radius, and shadow in the mock is final. Reproduce pixel-faithfully.

**Companion handoff:** The broader visual redesign — design tokens, topbar, stepper, and all other steps — is documented in `../design_handoff_redesign/README.md`. This handoff only covers the **Finalize step body**; the page chrome (topbar, stepper, floating step nav, chat bubble) is identical to the rest of the flow and is already documented there.

---

## 1. What changed on Finalize

The old Finalize screen led with a noisy **Trip Health** module (dark hero with a circular score ring + an issue list filterable as All/Open/Resolved). It has been **removed**.

The new Finalize screen, top to bottom:

1. **Headline** — "Here it is, end to end." (italic serif accent on "end to end")
2. **Action buttons** — three primary actions in a 3-column row: *Sync with Google Calendar*, *Export as PDF*, *Share with Friends*
3. **Trip stats card** — title + route on the left, six mono metric cells on the right
4. **Open items** — pending booking confirmations for ticketed activities
5. **Day-by-day itinerary** — the finalized itinerary surfaced from the Arrange step
6. **Footer** — auto-save status + version metadata

The previous "Lock trip & open Itinerary" CTA module is gone — finalization is implicit; locking happens via the floating step-nav button at the bottom-right of the viewport.

---

## 2. Layout & structure

The Finalize body is constrained to a centered column:

```
.fin { max-width: 880px; margin: 0 auto; }
```

Vertical rhythm between sections is controlled by `--fin-gap` (default `28px`); top padding by `--fin-pad-top` (default `32px`). All section boundaries are rendered as outlined cards on `--paper-1` with a single hairline `1px solid var(--hair)` and the small `--sh-sm` shadow.

### Section order

```
┌──────────────────────────────────────────────┐
│  Eyebrow: STEP 04 — FINALIZE                 │
│  H1: Here it is, end to end. (serif italic)  │
│  Lead: Your trip, laid out day by day…       │
├──────────────────────────────────────────────┤
│  [Calendar]  [PDF]  [Share]                  │   ← action tiles
├──────────────────────────────────────────────┤
│  ┌─────────────────┬───────────────────────┐ │
│  │ Trip            │ Dates  Nights Travelers│ │
│  │ Four days in    │ 05/04  4      2        │ │   ← trip card
│  │ Spain (serif)   │ Cities Activities Spend│ │
│  │ Barcelona → MAD │ 2      16     $1,420   │ │
│  └─────────────────┴───────────────────────┘ │
├──────────────────────────────────────────────┤
│  Needs a confirmation number    [3 open]     │
│  ┌──────────────────────────────────────────┐│
│  │ May 04 15:00  Picasso Museum         [+] ││
│  │ May 05 12:00  Park Güell             [+] ││   ← open items
│  │ May 06 21:30  Flamenco · Tablao…     [+] ││
│  └──────────────────────────────────────────┘│
├──────────────────────────────────────────────┤
│  Day-by-day itinerary      16 stops · 4 days │
│  ┌──────────┬───────────────────────────────┐│
│  │ Day 01   │ 09:00–09:45  • Hotel check-in ││
│  │ Mon May4 │ 10:30–12:30  • Gothic Quarter ││   ← itinerary
│  │ Arrival  │ 13:00–14:15  • Lunch · El X…  ││
│  │ Barcelona│ …                             ││
│  ├──────────┼───────────────────────────────┤│
│  │ Day 02   │ …                             ││
│  └──────────┴───────────────────────────────┘│
├──────────────────────────────────────────────┤
│  ● Auto-saved · 12s ago     v 03 · 4 days …  │
└──────────────────────────────────────────────┘
```

---

## 3. Section-by-section spec

### 3.1 Header (`.fin-h`)

| Element | Spec |
|---|---|
| Eyebrow | `.gm-eyebrow` — Geist Mono 11px, 0.14em tracking, uppercase, color `--text-500`. Copy: `Step 04 — Finalize` |
| H1 | Geist 40px / weight 500 / `-0.028em` / line-height 1.04 / color `--text-900` / max-width 620px / `text-wrap: pretty`. Copy: `Here it is, end to end.` — last 3 words wrapped in `<span class="serif">` (Instrument Serif italic, weight 400). |
| Lead `<p>` | 14.5px / `--text-500` / max-width 540px / line-height 1.55. Copy: `Your trip, laid out day by day. Take one last read, then send it where you'll need it.` |
| Bottom margin | 36px |

### 3.2 Action buttons (`.fin-send`)

3-column CSS grid (`repeat(3, 1fr)`), 12px gap, collapses to single column ≤720px. Each tile (`.send-tile`):

- `padding: 16px 18px`, `background: --paper-1`, `border: 1px solid --hair`, `border-radius: --r-lg` (16px), `box-shadow: --sh-sm`.
- Hover: `border-color: --text-900`, `transform: translateY(-1px)`, `box-shadow: --sh-md`.
- Layout: icon (20×20, stroke `--text-700`) → h4 (14px / weight 500) → p (12px / `--text-500` / line-height 1.45). Top-right corner has a small ↗ arrow that translates +2/-2 on hover.

The three tiles, in order:

| Title | Description | Icon |
|---|---|---|
| Sync with Google Calendar | One event per stop, with addresses and booking notes attached. | calendar (rect + grid + 2 ticks at top) |
| Export as PDF | Print-ready dossier with maps, bookings, and offline-friendly day pages. | document with fold and lines |
| Share with Friends | A live link they can open on their phone — read-only, always current. | three-node share graph |

Bottom margin: 28px.

### 3.3 Trip stats card (`.fin-trip`)

Outlined card, `border-radius: --r-lg`, `box-shadow: --sh-sm`. Inner grid 2-column 1.1fr / 1fr; collapses to single column ≤760px.

**Left cell (`.fin-trip__title`)** — `padding: 32px 32px 28px`, right border `1px solid --hair`:
- Eyebrow (Geist Mono 10.5px / 0.14em / uppercase / `--text-500`): `Trip`
- H2 (Geist 24px / weight 500 / `-0.02em`): `Four days in Spain` — "Spain" wrapped in `<span class="serif">`. Margin `10px 0 14px`.
- Route (Geist Mono 12px): `Barcelona → Madrid` — cities are `.city` (color `--text-900`, weight 500), arrow is `.arrow` (color `--text-400`). 6/8px flex gap.

**Right cell (`.fin-trip__stats`)** — `padding: 32px 32px 28px`, 4-column grid, gap `16px 24px` (collapses to 2-column ≤520px). Each cell (`.fin-stat`):
- Key `.k`: Geist Mono 10px / 0.14em / uppercase / `--text-500` / `margin-bottom: 6px`
- Value `.v`: Geist Mono 16px / weight 500 / `--text-900` / tabular-nums / nowrap
- Unit `.v .u`: same font, `--text-500`, weight 400, `margin-left: 2px`

The six stats, in grid order:

| Key | Value |
|---|---|
| `Dates` | `05/04 → 05/07` (arrow is `<span class="u">→</span>`) |
| `Nights` | `4` |
| `Travelers` | `2` |
| `Cities` | `2` |
| `Activities` | `16` |
| `Spend` | `$1,420 / 1,500` (slash + budget in `.u`) |

Bottom margin: 28px.

### 3.4 Open items (`.fin-open`)

Outlined card, same chrome as trip card.

**Header (`.fin-open__head`)** — `padding: 18px 22px 14px`, `border-bottom: 1px solid --hair`:
- H3 (14.5px / weight 500 / `--text-900`): `Needs a confirmation number`
- Count pill (Geist Mono 10.5px / 0.06em / uppercase / weight 500): `3 open` — color `--warn` (`#C08B10`), background `rgba(192,139,16,.10)`, `padding: 2px 8px`, pill radius.
- Subtext (12.5px / `--text-500` / line-height 1.45 / max-width 460px): `Ticketed activities you've planned but haven't booked yet. Attach a reference so we can include it in your day-of pass.`
- Right action `.action` (Geist Mono 10.5px / 0.08em / uppercase / `--text-500`, hover → `--text-900`): `Attach all →`

**List rows (`.open-item`)** — each row is `display: grid; grid-template-columns: auto 1fr auto; gap: 16px; padding: 14px 22px;` with a hairline bottom border (last row omits it). Hover bg `--paper-0`.

Three columns per row:

1. **Date chip `.open-item__when`** — 56px wide, `padding: 8px 6px`, `background: --paper-2`, `border-radius: --r-sm` (6px). Three lines centered:
   - `.d` (Mono 9.5px / 0.10em / uppercase / `--text-500`) — month abbreviation
   - `.n` (Mono 16px / weight 500 / `--text-900` / `-0.01em` / line-height 1) — day number
   - `.t` (Mono 9.5px / 0.04em / `--text-500` / margin-top 3px) — start time `HH:MM`
2. **Body `.open-item__body`** — flex column, 3px gap:
   - Title (14px / weight 500 / `--text-900`), inline with `.open-item__missing` pill: Mono 9.5px / 0.10em / uppercase / `--warn`, background `rgba(192,139,16,.10)`, leading 5px dot in `--warn`.
   - Why-line (12.5px / `--text-500` / line-height 1.45). Inline `.price` uses Mono and `--text-700`.
3. **CTA `.open-item__cta`** — pill: height 30px / `padding: 0 14px` / `background: --ink-900` / `color: --paper-0` / 12.5px / weight 500. Hover → `--ink-800`. Includes a 12×12 `→` SVG that translates 2px right on hover.

The three open items (final copy):

| Date chip | Title | Missing | Why-line |
|---|---|---|---|
| MAY 04 / 15:00 | Picasso Museum | No booking ref | Timed entry — book ahead or expect a 30–60 min queue. €14 / adult |
| MAY 05 / 12:00 | Park Güell — Monumental Zone | No booking ref | Slot-based entry; weekends sell out 3–5 days ahead. €10 / adult |
| MAY 06 / 21:30 | Flamenco · Tablao Cordobés | No reservation | Late show, 2 seats — venue confirms by email within 24h. €47 / person |

**Resolved state:** when an item is resolved, add `.resolved` to the row:
- Row `opacity: 0.5`
- Title gets `text-decoration: line-through` (`text-decoration-color: --text-400`, thickness `1px`)
- `.open-item__missing` flips to `color: --ok` (`#1F9D55`), background `rgba(31,157,85,.10)`, dot `--ok`, text becomes `Confirmed`
- CTA pill becomes `background: --paper-2; color: --text-500;`, text becomes `Resolved`
- The header count pill: when count reaches 0, text becomes `All set` with `color: --ok` and background `rgba(31,157,85,.10)`.

**Pending markers in the itinerary** — each ticketed activity with a missing ref carries a `.item__pending` marker (14×14 amber circle with a centered `!` glyph, `rgba(192,139,16,.16)` bg, `--warn` text) inline next to its title. Markers must stay in sync with the open-items state: when an item is resolved in the open-items list, hide the corresponding marker in the itinerary (and vice versa if your implementation supports both directions).

Bottom margin: 28px.

### 3.5 Day-by-day itinerary (`.fin-itin`)

**Section header (`.fin-itin__head`)** — flex row, baseline-aligned, `margin-bottom: 18px`:
- H3 (18px / weight 500 / `-0.012em` / `--text-900`): `Day-by-day itinerary` — last word wrapped in `<span class="serif">`.
- Meta (Mono 11px / 0.04em / `--text-500`): `16 stops · 4 days · 2 cities` — pipes (`·`) are `.pipe` (color `--text-400`).

**List card (`.fin-itin__list`)** — outlined card. Each day is a 2-column grid `180px / 1fr` (collapses to 1-column ≤640px), with a hairline between days.

**Day head (`.day__head`)** — left column, `padding: 22px 24px`, right border `1px solid --hair`. Three stacked elements:
1. Day number (Mono 10px / 0.14em / uppercase / `--text-500` / `margin-bottom: 8px`) — `Day 01` etc.
2. Date block:
   - `.day-name` (Mono 11px / 0.06em / uppercase / `--text-500` / margin-bottom 4px) — `Mon · May 04`
   - Plain text (15px / weight 500 / `--text-900` / line-height 1.25) — day theme: `Arrival`, `Gaudí day`, `Slow day`, `To Madrid`
3. `.day__city` (Mono 11px / 0.04em / `--text-500` / `margin-top: 10px`) — preceded by a 5px dot in `--text-400`. Values: `Barcelona`, `Barcelona`, `Barcelona`, `Madrid`.

**Day items (`.day__items`)** — `padding: 14px 0`. Each `.item` is a 4-column grid `120px 12px 1fr auto`, baseline-aligned, `gap: 14px`, `padding: 8px 24px`. Hover bg `--paper-0`. On ≤640px columns shrink to `96px 10px 1fr auto`, padding `8px 22px`, gap 10px.

Item columns:
1. `.item__time` (Mono 11.5px / `--text-500` / tabular-nums / nowrap) — `HH:MM–HH:MM` with `.dash` (color `--text-400`, 3px horizontal margin).
2. `.item__dot` (8×8 circle, self-aligned center, 3px paper-1 ring that flips to paper-0 on row hover). Color comes from the row's category class:
   - `.cat-food` → `#D28C00`
   - `.cat-tour` → `--accent` (`#2F7DFB`)
   - `.cat-culture` → `#783CD2`
   - `.cat-outdoor` → `--ok` (`#1F9D55`)
   - `.cat-night` → `#CF3273`
   - `.cat-transit` → `--text-400` (`#8490A3`)
3. `.item__title` (14px / weight 500 / `--text-900` / line-height 1.4 / `text-wrap: pretty`). Optional `<span class="note">` for secondary info (e.g. `timed entry`, `seat 7A`, `Casa Camper`) — Mono 10.5px / weight 400 / 0.04em / uppercase / `--text-500` / `margin-left: 8px`. Optional `<span class="item__pending">` (see open items above).
4. `.item__cat` (Mono 10px / 0.12em / uppercase / `--text-500` / pill `padding: 2px 8px` / bg `--paper-2`) — title-case category label: `Transit | Tour | Food | Culture | Outdoor | Night`.

**Full itinerary content** — see `Finalize.html` for the canonical source. Summary:

| Day | Date | Theme | City | Stops |
|---|---|---|---|---|
| 01 | Mon · May 04 | Arrival | Barcelona | Hotel check-in (Casa Camper) · Gothic Quarter walking tour · Lunch at El Xampanyet · **Picasso Museum** (pending) · Tapas crawl, El Born |
| 02 | Tue · May 05 | Gaudí day | Barcelona | Sagrada Família tour (timed entry) · **Park Güell** (pending) · Lunch in Gràcia · Bunkers del Carmel sunset |
| 03 | Wed · May 06 | Slow day | Barcelona | Paella cooking class · Barceloneta beach · **Flamenco at Tablao Cordobés** (pending) |
| 04 | Thu · May 07 | To Madrid | Madrid | AVE 02064 · BCN → MAD (seat 7A) · Prado Museum · Lunch at Mercado de San Miguel · Retiro Park stroll |

### 3.6 Footer (`.fin-foot`)

Flex row, justified, `margin-top: 32px`, `padding-top: 22px`, `border-top: 1px solid --hair`. Two `.meta` spans (Mono 11px / 0.04em / `--text-500`):

- Left: `<span class="dot"></span> Auto-saved · last edit 12s ago` — the dot is a 6×6 circle in `--ok` with a `0 0 0 3px rgba(31,157,85,.18)` ring.
- Right: `v 03 · 4 days · 16 activities`

---

## 4. Interactions

| Trigger | Behavior |
|---|---|
| Click on an action tile (Calendar / PDF / Share) | Opens the corresponding system flow (delegate to existing services). Buttons are not yet wired in the mock — implement against the real backend integrations. |
| Click on `.open-item__cta` ("Add confirmation") | In the real app, open the booking-attach dialog (re-use the existing dialog from Step 02 Review). In the mock, it simulates a resolution: the row gets `.resolved`, the missing pill becomes "Confirmed" in `--ok`, the CTA text becomes "Resolved", and the header count pill recounts. The corresponding `.item__pending` marker in the itinerary is hidden. |
| Click on header "Attach all →" | Sequentially walks all open items through the attach flow. |
| Click on `.mode button` (Planning / Itinerary) | Existing topbar toggle — keep behavior identical to other steps. |
| Floating step-nav buttons (bottom-right) | Back / save / **lock** — the lock icon is what commits the trip. Identical to existing patterns. |
| Hover on `.send-tile` / `.open-item` / `.item` | All have hover states defined in CSS. Match exactly. |

No client-side filtering or sorting on the itinerary. No drag-to-reorder (that lives in Step 03 Arrange).

---

## 5. State / data model

The Finalize screen renders the same trip data that Step 03 Arrange produces. Use the existing app store; do not invent new state for this screen.

**Inputs needed:**

```ts
type Trip = {
  title: string;                  // "Four days in Spain"
  cities: string[];               // ["Barcelona", "Madrid"]
  startDate: Date;                // 2025-05-04
  endDate: Date;                  // 2025-05-07
  travelers: number;              // 2
  budget: { spent: number; cap: number; currency: string };  // { 1420, 1500, "USD" }
  days: Day[];
};

type Day = {
  num: string;                    // "01"
  date: Date;                     // weekday + month/day rendered
  theme: string;                  // "Arrival" — user- or AI-set day label
  city: string;
  items: Activity[];
};

type Activity = {
  id: string;
  title: string;
  note?: string;                  // small uppercase secondary line
  category: 'food'|'tour'|'culture'|'outdoor'|'night'|'transit';
  start: number;                  // hours since midnight (e.g. 9.5)
  duration: number;               // hours
  ticketed: boolean;              // true → may show up in open-items
  bookingRef?: string;            // present → confirmed; absent on a ticketed item → flagged
  whyMissing?: string;            // copy for the open-items why-line (server-supplied or templated)
  price?: { amount: number; unit: string; currency: string }; // for the why-line price chip
};
```

**Derived state:**

- `openItems = activities.filter(a => a.ticketed && !a.bookingRef)`
- The open-items count pill: `openItems.length === 0 ? "All set" : `${n} open``
- `.item__pending` markers render iff `a.ticketed && !a.bookingRef`.

**Stat computations** for the trip card:

- Nights = `(endDate - startDate)` in days
- Cities = `unique(days.map(d => d.city)).length`
- Activities = `sum(days.map(d => d.items.length))`

---

## 6. Design tokens used

All tokens used on Finalize already live in `mocks/styles/tokens.css` (also documented in the broader handoff). Quick reference for this screen specifically:

| Token | Value | Where it's used |
|---|---|---|
| `--paper-0` | `#F4F1EC` | Page bg, item hover bg |
| `--paper-1` | `#FAF8F4` | All cards (tiles, trip, open-items, itinerary) |
| `--paper-2` | `#EEEAE3` | Date chips, category pills, resolved-CTA bg |
| `--ink-900` | `#0A1628` | Open-items CTA pill bg, headings |
| `--ink-800` | `#112240` | CTA hover |
| `--text-900` | `#0A1628` | Headings, titles, stat values |
| `--text-700` | `#1E293B` | Body, in-line `.price` |
| `--text-500` | `#5A6679` | All metadata, eyebrows, lead copy |
| `--text-400` | `#8490A3` | Pipes, dashes, dot fills for transit + city marker |
| `--hair` | `rgba(10,22,40,.08)` | All card borders & internal dividers |
| `--accent` | `#2F7DFB` | Tour-category dot (only place it appears on this screen) |
| `--ok` | `#1F9D55` | Resolved state, footer auto-save dot, outdoor-category dot |
| `--warn` | `#C08B10` | Open-items count pill, missing pill, `.item__pending` markers |
| Category dots | `#D28C00 / #2F7DFB / #783CD2 / #1F9D55 / #CF3273 / #8490A3` | food / tour / culture / outdoor / night / transit |
| `--r-sm` | `6px` | Date chips |
| `--r-lg` | `16px` | All cards & tiles |
| `--r-pill` | `999px` | All pills (CTA, missing, count, category) |
| `--sh-sm` | `0 1px 2px rgba(10,22,40,.04), 0 1px 1px rgba(10,22,40,.03)` | All cards at rest |
| `--sh-md` | `0 4px 18px rgba(10,22,40,.06), 0 2px 6px rgba(10,22,40,.04)` | Tile hover |
| `--dur-fast` | `140ms` | All hover/state transitions |

**Type**

- Geist 300/400/500/600/700 (Google Fonts)
- Geist Mono 400/500 (Google Fonts) — all metadata, times, eyebrows, monocaps
- Instrument Serif (Google Fonts) — italic accents on H1 / H2 / H3 ("end to end.", "Spain", "itinerary")

---

## 7. Responsive behavior

| Breakpoint | Change |
|---|---|
| ≤760px | Trip card collapses to single column; left cell gets a bottom hairline instead of a right one |
| ≤720px | Action tiles collapse to single column |
| ≤640px | Itinerary days collapse to single column; day head sits above day items with a bottom hairline; item grid tightens (`96px 10px 1fr auto`, padding 8px 22px) |
| ≤520px | Trip stats collapse from 4-col to 2-col |

---

## 8. Accessibility

- All buttons (`.send-tile`, `.open-item__cta`, action links, mode toggle, step-nav) must be real `<button>` elements with visible focus states. The mock uses default focus rings; in the real app, add a focus-visible ring at `2px solid --accent` with `2px` offset on all interactive surfaces.
- The H1 / H2 / H3 hierarchy on this page: `<h1>` for the screen headline, `<h2>` inside the trip card, `<h3>` for "Needs a confirmation number" and "Day-by-day itinerary", `<h4>` for action-tile titles. Preserve this order.
- The pending-marker `<span class="item__pending">` carries a `title` attribute (`Booking confirmation needed` or `Reservation needed`). For real implementation, expose the same message via `aria-label` and `role="img"` so it announces to screen readers.
- Color is never the only signal: missing-ref pills include the word "No booking ref" / "No reservation", and open-items have an explicit CTA — the dot/color is reinforcement.

---

## 9. What's *not* on this screen anymore

For implementers familiar with the previous design:

- ❌ The dark **Trip Health** hero with the circular score ring is gone.
- ❌ The All / Open / Resolved filter pills are gone.
- ❌ The "Ready to lock it in?" CTA card with the "Keep editing" + "Lock trip & open Itinerary" buttons is gone. Locking moves to the floating step-nav lock icon (already present, unchanged behavior).
- ❌ The "Trip Health" topbar icon (the heartbeat glyph) is removed from this screen.

---

## 10. Files in this bundle

```
design_handoff_finalize/
├── README.md                ← this file
└── mocks/
    ├── Finalize.html        ← the design reference
    └── styles/
        ├── tokens.css       ← design tokens (shared with the rest of the redesign)
        └── planner.css      ← chrome (topbar, stepper, floating step-nav, chat bubble)
```

Open `mocks/Finalize.html` directly in a browser to interact with the design. The tweaks panel in the bottom-right is a **prototyping aid only** — do not ship it. Its controls (density, accent, section visibility, category-tag visibility) exist so the team can audit alternative configurations during review; they are not user-facing features.

---

## 11. Out of scope

- Page chrome (topbar, brand mark, mode toggle, stepper, floating step-nav, chat bubble) — see `../design_handoff_redesign/README.md`.
- Step 01 Setup, Step 02 Review, Step 03 Arrange — see same.
- The Itinerary mode (the read-only post-finalization view) — see same.
- Actual integration with Google Calendar, PDF generation, share-link backend — implement against existing services; copy in the mock is final.
