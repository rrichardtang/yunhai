# Handoff: YunHai Landing Page — "How It Works" Demos

## Overview

This package documents the redesigned **landing page first screen** for YunHai (a
travel-itinerary product; the prototype files still carry the working name
"GuideMe" in chrome/logo — see *Naming* below). The page's job is to sell a paid
subscription by **showing the product working**, not describing it.

It is structured as a hero followed by three full-width **"chapters,"** each of
which contains a **self-running, on-brand product demo** that auto-plays once when
scrolled into view and can be replayed with a button. These three demos are the
heart of this handoff and the focus of this document:

| # | Chapter title | Selling point | Demo mechanism |
|---|---|---|---|
| 01 | **Completely yours** | Personalization that learns | Profile builder fills itself, generates an AI summary, then a live "preference signal" is typed in and saved |
| 02 | **Sequenced by data** | Efficient day ordering | A pace dot-scale is chosen, then a day's activities drop into a timeline with real transit-time pills between them |
| 03 | **All in one place** | Attach tickets + share anywhere | An itinerary view where a cursor uploads a ticket file, opens a files popover, then exercises Calendar / Share / PDF export |

The page also has a hero (product-window mock of a finished itinerary) and a
Tweaks panel — documented briefly at the end — but **the three demos are the
priority for faithful rebuild.**

---

## About the Design Files

The files in this bundle are **design references created in plain HTML/CSS/JS** —
prototypes that show the intended look, motion, and behavior. They are **not
production code to copy verbatim.**

Your task is to **recreate these demos in the target codebase's environment**
(React, Vue, Svelte, etc.) using its established component patterns, animation
approach, and styling system. If the project has no front-end environment yet,
pick the most appropriate framework and implement there. The vanilla JS timeline
controllers included here are a faithful **spec of the animation choreography**
(what changes, in what order, at what time) — translate that choreography into the
target stack (e.g. a React state machine, GSAP/Framer Motion timeline, or CSS
keyframes), rather than porting the `setTimeout` code 1:1.

---

## Fidelity

**High-fidelity (hifi).** Colors, typography, spacing, motion timing, and copy are
all final. Recreate pixel-faithfully using the values in this document and the
included CSS. The demos should look and animate identically to the prototypes.

---

## Shared Foundations (all three demos)

### Design tokens
Full set in `styles/tokens.css`. The values the demos lean on most:

**Color**
| Token | Value | Use |
|---|---|---|
| `--ink-900` | `#0A1628` | Primary dark (demo bars, dark scenes, flight chip) |
| `--ink-abyss` | `#070B12` | Deepest dark |
| `--paper-0` | `#F4F1EC` | Ivory page base |
| `--paper-1` | `#FAF8F4` | Card surface |
| `--paper-2` | `#EEEAE3` | Alternating/elevated surface |
| `--paper-3` | `#E2DED6` | Muted track backgrounds |
| `--text-900` | `#0A1628` | Headings |
| `--text-700` | `#1E293B` | Body |
| `--text-500` | `#5A6679` | Muted / metadata |
| `--text-400` | `#8490A3` | Placeholder |
| `--accent` | `#2F7DFB` | Electric-ocean accent (primary) |
| `--accent-hover` | `#1D6DE8` | |
| `--accent-soft` | `#E6EFFE` | Accent-tinted fills |
| `--accent-deep` | `#0B4AB8` | Accent text on soft fill |
| `--ok` | `#1F9D55` | Success (attached, saved, done) |
| `--warn` | `#C08B10` | |
| `--err` | `#C0362C` | PDF file tag red is `#C0392B` |
| `--hair` | `rgba(10,22,40,0.08)` | Hairline borders |
| `--hair-strong` | `rgba(10,22,40,0.14)` | Stronger hairline |

**Type** — `--font-sans: 'Geist'` (UI), `--font-mono: 'Geist Mono'` (all data /
labels / times / counts), `--font-display: 'Instrument Serif'` (italic accent
words inside headings only). Mono is used heavily for the "data-dense / technical"
feel — times, prices, counts, kicker labels.

**Radii** — `--r-sm:6px --r-md:10px --r-lg:16px --r-xl:24px --r-pill:999px`

**Shadow** — `--sh-sm`, `--sh-md`, `--sh-lg` (popovers/cards use `--sh-lg`).

**Motion** — `--ease-out: cubic-bezier(.2,.8,.2,1)`,
`--ease-inout: cubic-bezier(.65,0,.35,1)`, durations
`--dur-fast:140ms --dur-med:280ms --dur-slow:520ms`.

### The "∴" mark
Demos label their status with a `∴` (therefore) glyph prefix, e.g.
"∴ Building your profile". It's a literal character, not an icon.

### Chapter shell (wraps every demo)
Each chapter is a two-column grid: a **copy column** (kicker `01/02/03` + serif-
accented `<h2>` + lede + 3 bullet points + a **Replay** button) and a **demo
column** (the interactive frame). Chapters alternate background; chapter 2's copy
column is reversed to the right (`.chapter--rev`). See `styles/landing-demos.css`
(`.chapter*`, `.demo*`) for the shell — this is shared chrome, identical across
demos.

**Demo frame chrome** (`.demo` / `.demo__bar`): a rounded card (`--r-xl`) with
`--sh-lg`. The top bar (`.demo__bar`) holds a `∴` status tag on the left and one
or two right-aligned **stat readouts** (`.demo__stat`: a tiny uppercase mono label
`.k` over a larger mono value `.v`). The demos update these tag/stat texts live as
they play.

### Autoplay pattern (all three identical)
Each demo:
1. Runs `reset()` to its initial state on load.
2. Wires its **Replay** button (`.chapter__replay[data-replay="<id>"]`) to re-run.
3. Auto-plays **once** when ≥50% of the frame (capped to viewport height) is
   visible — using a scroll/resize listener that measures overlap directly
   (NOT a single-threshold IntersectionObserver, which fails when the demo is
   taller than the viewport). Re-implement this "play once on scroll-in" with
   whatever your stack provides (e.g. IntersectionObserver with multiple
   thresholds, or a viewport hook), but **keep the "fire once, then detach"
   semantics.**

While playing, the Replay button gets `.is-playing` (dimmed, disabled); the demo
calls a `done()` callback at the end to clear it.

The three controllers share a tiny `Timeline` helper — `tl.at(ms, fn)` schedules a
step, `tl.clear()` cancels all (used by `reset()`). Timings below are quoted from
these controllers and are the **canonical choreography**.

---

## DEMO 01 — "Completely yours" (Personalization)

**Files:** `styles/landing-demo-profile.css`, `scripts/landing-demo-profile.js`
**Root selector:** `[data-demo="personalize"]` · **Frame height:** 568px (fixed)

A two-scene sequence inside one frame; scenes cross-fade
(`.pf__scene` → `.is-active`, opacity 460ms).

### Scene 1 — Profile builder (top ~70%) + AI summary (bottom ~30%)
Purpose: show the user telling YunHai their taste, then YunHai bundling it into a
profile.

**Layout:** `.pf__qs` (questions, flex column, gap 13px, padding 17/18/14) stacked
above a fixed **168px** navy summary panel (`.pf__summary`, bg `--ink-900`).

**Four questions** (`.pfq`, each fades+slides up via `.in`):
- **Q1 "What kind of traveler are you?"** — pill row (`.pfpill`). Options:
  `Foodie · Culture · Outdoors · Nightlife · Slow travel · Off the beaten path`.
- **Q2 "How packed do you like your days?"** — pills: `Relaxed · Balanced · Packed`.
- **Q3 "Anything you love that guidebooks skip?"** — free-text field
  (`.pfq__field` with `.pfq__typed` + blinking `.pfq__caret`).
- **Q4 "Who's coming along?"** — free-text field.

Each question has a mono number tag (`.pfq__n` = `01`…`04`). A picked pill
(`.picked`) turns accent-soft bg + accent-deep text + lifts 1px. The active text
field (`.is-active`) gets an accent ring; while typing it has `.is-typing`
(shows caret).

**AI summary panel** (`.pf__summary`, navy): a mono header (`.pf__summary-head`)
with a pulsing accent dot, and a body paragraph (`.pf__summary-body`). Header text
color is `#7FB0FF` while working, flips to green `#6EDB96` + `.done` when ready.

**Scene 1 choreography** (`play()` from `t=300`):
| Time (ms) | Event |
|---|---|
| 300 | Q1 fades in |
| 750 / 1020 / 1280 | Pills picked: Foodie, Slow travel, Off the beaten path |
| 1050 | Top-bar stat "Answered" → `1 / 4` |
| 1700 | Q2 fades in |
| 2100 | Pill picked: Balanced → stat `2 / 4` |
| ~2550 | Q3 fades in + types **"Sunsets, tiny vinyl bars, anywhere with a view"** (24 ms/char) → `3 / 4` |
| after Q3 +360 | Q4 fades in + types **"Me + my partner — quiet mornings, lively nights"** → `4 / 4` |
| after Q4 +450 | Header → "Generating your traveler profile…", body types out (17 ms/char): **"Curious, slow-paced, and food-led — you'd rather find the offbeat than tick off a top-10. Calm mornings, lively nights, and always somewhere with a view."** |
| on finish | Header → "Traveler profile ready" + `.done` (green) |

Top bar during scene 1: tag `∴ Building your profile`, stat label `Answered`.

### Scene 2 — Activity card + live preference signal
Purpose: show that you can add a preference anytime and it sticks + immediately
improves a suggestion. Cross-fades in ~1100 ms after the summary finishes.

**Layout:** `.pf__use` — 2-col grid (`1fr 0.92fr`): an **activity card**
(`.acard2`) on the left, a **signal panel** (`.pf__signal`) on the right.

**Activity card** (`.acard2`) — faithful to the product's real review/activity
card:
- `.acard2__media` (118px) — a navy gradient placeholder with a faint grid mask
  and a mono caption ("meiji jingu shrine"); a green circular ✓ badge top-left
  (`.acard2__approved`).
- Body: two mono tag pills (`Landmark`, `◎ map`), title **"Meiji Jingu Shrine"**,
  city line **"Tokyo, Japan"**, a **"Why it fits:"** line (`[data-why]`), a
  **"Booking:"** line ("Free entry, open dawn–dusk — no booking needed."), an
  accent-soft **"∴ Insider"** tip box, and two action buttons (✓ Approve /
  Decline).
- An **"↑ Updated for your sunset signal"** pill (`[data-updated]`) that fades in.

**Signal panel** (`.pf__signal`):
- Heading "Tell us what you *love* — anytime" (serif italic on "love").
- A text input box (`.pf__signal-input`) with a round accent **send** button
  (`.pf__signal-send`).
- A "Saving signal…" status (`.pf__signal-status`, pulsing dot) and a green
  "Signal saved to your profile" confirmation (`.pf__signal-saved`, ✓).
- A **"∴ Learned about you"** chip set (`.pf__learned-chips`): existing chips
  `Foodie / Slow travel / Off the beaten path`, plus a NEW accent chip
  **"Sunset views"** (`.lchip--new`, rendered with a `+` prefix) that pops in.

**Scene 2 choreography** (offsets from scene-2 start `s2`):
| Time | Event |
|---|---|
| s2 | Cross-fade; top bar tag → `∴ Refine anytime`, stat label → `Signals`, value `saved 0` |
| s2+650… | Input gets `.is-typing`, types **"I love watching sunsets. Find me a shrine where I can watch the sunset from."** (17 ms/char) |
| +250 | Send button pulse |
| +350 | "Saving signal…" shows |
| +1100 | Saving hides, "Signal saved" shows, stat → `saved 1` |
| +1500 | New **"Sunset views"** chip pops in |
| +1900 → +2180 | Card's "Why it fits" text fades out then swaps to: **"The west-gate path frames a clean sunset over the great wooden torii — exactly the kind of evening you flagged."** |
| +2200 | "Updated for your sunset signal" pill fades in |

---

## DEMO 02 — "Sequenced by data" (Efficient ordering)

**Files:** `styles/landing-demo-sequence.css`, `scripts/landing-demo-sequence.js`
**Root selector:** `[data-demo="sequence"]` · **Frame height:** 566px (fixed)

Two scenes, cross-fade (`.sq2__scene` → `.is-active`).
**Note:** this chapter uses the reversed layout (`.chapter--rev`, copy on the
right). Despite the dark visual heritage, the demo frame itself is **light**
(`.demo--light`).

### Scene 1 — Scheduling preference (pace dot-scale)
Purpose: the user sets their pace once. Faithful to the product's real pace
question.

**Layout:** centered column (`.sqp`, padding 34/40). Eyebrow "Scheduling
preference", heading **"How *packed* do you like your days?"** (serif italic on
"packed"), a sub-paragraph, then a **5-dot scale**.

**Dot scale** (`.sqp__scale`): a horizontal hairline track with a dark progress
fill (`.sqp__fill`) and 5 dots (`.sqd`) evenly spaced. Dot states: default
(hollow, hairline border); `.done` (filled navy); `.now` (enlarged 22px, accent
ring + accent core + glow). End labels (`.sqp__ends`): "Very relaxed" ↔ "Non-stop".
Below: a choice line (`.sqp__choice`) — large serif-italic **"Moderate"** + an
accent-soft meta pill **"≈ 4 stops/day · 9h window"** (`.now-meta`, fades in).

**Choreography:** dots advance one every 300 ms from index 0 → **2** ("Moderate",
the 3rd dot). The fill width grows to match `(idx / 4) * 100%`. At index 2 settled,
the `.now-meta` pill fades in (~`afterScale`).
Top bar: tag `∴ Scheduling preference`, stat `Step = 1 / 2`.

### Scene 2 — Itinerary fill (timeline with transit pills)
Purpose: show activities dropping into the day in order, with **real transit
times** between stops. Cross-fades in ~1100 ms after scene 1 settles.

**Layout:** `.sqf` column — header (`.sqf__head`: "Day 02 · **Tokyo**" + a stop
count pill `.sqf__count`), a scrollable track (`.sqf__track`) of rows
(`.sqf__rows`), and a footer (`.sqf__foot`).

**Row types** (each tagged `[data-sq-step]`, revealed in DOM order):
- **Anchor** (`.sqanchor`, dashed border) — "Arrive · Haneda (HND)" + time `09:00`,
  with a plane icon.
- **Transit pill** (`.sqtransit`, centered rounded pill) — a bus/transit icon +
  e.g. "27 min". Each carries `data-mins="NN"`.
- **Activity card** (`.sqcard`) — a colored left strip (`--strip` set inline:
  green `#1F9D55`, violet `#7A5AF0`, amber `#E08A1E`, accent `#2F7DFB`), a mono
  time range with a clock icon, and an icon + title.

**The four activities (in order):**
1. `09:30 – 11:00` Shinjuku Gyoen Garden (green strip)
2. `11:30 – 13:00` Nintendo Tokyo (violet)
3. `13:25 – 14:25` Tsukemen at Fuunji (amber)
4. `14:55 – 16:25` Shibuya Sky observation deck (accent)

**Transit pills between them:** 27 → 33 → 24 → 30 min (one before each activity,
following the anchor).

**Footer:** a note (`.sqf__note`, fades in) **"Ordered for least backtracking —
transit times from live maps"** and a right-aligned total **"In transit · `1h
54m`"** (`[data-sq-total]`).

**Choreography:** after cross-fade (top bar tag → `∴ Ordering your day`, stat
`Stops = 0 / 4`), steps reveal in DOM order starting `s2+600`, gap **560 ms** for
anchors/cards and **360 ms** for transit pills. As each **card** reveals, the stop
count increments. As each **transit pill** reveals, its `data-mins` is **added to
a running total** that displays via `fmtMins` (e.g. 27→"27m", …, total
"1h 54m"). The footer note fades in after the last step.

> **Accuracy note (important):** This total is the **honest sum** of the transit
> pills (27+33+24+30 = 114 min = 1h 54m). An earlier version showed a fabricated
> "reclaimed hours" stat — **do not reintroduce any "time saved / reclaimed"
> figure.** The only number shown is total time in transit.

---

## DEMO 03 — "All in one place" (Attach + share anywhere)

**Files:** `styles/landing-demo-organize.css`, `scripts/landing-demo-organize.js`
**Root selector:** `[data-demo="organize"]` · **Frame height:** 568px (fixed)

A single-scene itinerary view driven by a **faux cursor** that performs a full
upload → view → export flow.

**Layout** (`.og`, flex column):
- **Header** (`.og__head`) — "01 / 01" index, city **"Tokyo, Japan"**, dates
  **"May 7 → May 10 · 4 nights"**.
- **Day bar** (`.og__daybar`) — "Thu · May 7 **Day 01**".
- **Export toolbar** (`.og__tools`) — label "Your trip, anywhere" + three buttons
  (`.ogtool`): **Add to Calendar** (calendar icon, accent-tinted), **Share link**
  (share-nodes icon), **Download PDF** (download icon). Each button has an idle
  `.ico` and a hidden `.ck` checkmark; on `.done` it turns green
  (text `#157049`, bg `#EAF3EC`, border green) and swaps icon→check.
- **Stops** (`.og__stops`):
  - **Flight/arrival stop** (`.ogstop.is-flight`, highlighted `--paper-2` bg) —
    time `9:00 AM`, a dark **"Flight"** kind chip, title "Arrival · Haneda (HND)",
    meta line, a **booking status line** (`.ogstop__ref`), and three action
    buttons (`.ogact`): **Navigate**, **View Files** (starts `disabled`),
    **Upload Tickets**.
  - Two plain activity stops: "Senso-ji Temple & Nakamise" (`1:40 → 3:10 PM`),
    "Meiji Jingu Shrine" (`3:41 → 4:41 PM`).
- **Overlays** (absolutely positioned inside `.og`): faux cursor (`.og__cursor`),
  upload progress card (`.og__upload`, bottom-right), files popover
  (`.og__files`, bottom-right).

**Booking status line states** (`.ogstop__ref`):
- Empty: "No booking attached" — small dashed hollow dot before it.
- Attached (`.attached`): green filled dot + "Boarding pass ·
  `haneda-boarding-pass.pdf`" (filename in `<code>`). A `.flash` class plays a
  brief green background flash on transition.

**Action button hot state** (`.ogact.is-hot`): inverts to navy bg / ivory text
(used to show the cursor "pressing" Upload). The **View Files** button stores two
HTML strings in `data-empty` / `data-full` attributes — the full version appends a
mono count badge `1`.

**Upload card** (`.og__upload`): a red **PDF** file tag (`.og__filetag`, folded
corner), filename "haneda-boarding-pass.pdf", "248 KB · uploading…", a spinner that
swaps to a green check on `.done`, and a progress bar (`.og__upload-bar`) that
fills 0→100% over ~1100 ms (bar turns green on `.done`).

**Files popover** (`.og__files`): header "Arrival · Haneda" + "1 file"; a file row
(`.ogfile`) with a red PDF tag, "haneda-boarding-pass.pdf", "248 KB · added just
now", and an "Open" pill; footer **"On every stop · in your PDF export"** + two
party avatars (A / C).

> **Accuracy note (important):** Files are **not** viewable offline. The honest
> offline path is the **PDF export**, which bundles uploaded tickets. The popover
> footer therefore says "in your PDF export" — **do not claim files are "offline
> ready."**

**Faux cursor** (`.og__cursor`): a 22px arrow SVG. Moves via
`transform: translate(--cx,--cy)` (720 ms ease-inout). `moveCursorTo(target)`
computes the target's center relative to `.og`. `tap()` adds `.tap` (scale .84) for
180 ms to simulate a click.

**Choreography** (`play()`):
| Time (ms) | Event |
|---|---|
| 400 | Cursor fades in, moves to **Upload Tickets** |
| 1300 | Tap → Upload button goes `.is-hot` |
| 1560 | Upload card slides in |
| 1720 | Progress bar → 100% |
| 2950 | Upload `.done` (check + green bar); Upload button un-hots |
| 3250 | Booking line → **attached** ("Boarding pass · …pdf") + flash; View Files **enabled** (count 1); top-bar "Files" stat → `1` |
| 3900 | Upload card slides out |
| 4150 | Cursor moves to **View Files** |
| 4950 | Tap |
| 5200 | Files popover opens; file row(s) stagger in (+220 ms each) |
| 6050 → 6750 | Cursor → **Add to Calendar**, tap, button `.done` (green ✓) |
| 7050 → 7700 | Cursor → **Share link**, tap, `.done` |
| 8000 → 8650 | Cursor → **Download PDF**, tap, `.done` |
| 9200 | Cursor fades out |
| 9500 | `done()` |

Top bar: tag `∴ One place for everything`, stat label `Files` (0 → 1).

---

## Hero (context — lower priority than the demos)

Above the chapters. Left column: eyebrow "Personal itinerary intelligence",
headline **"Built around *you*. Not the crowd."** (serif italic "you"), a
sub-paragraph, two CTAs, a trust row, and a 3-up stat row (`.hero__stats`). Right
column: a **product-window mock** (`.heroapp`) of a finished itinerary — window bar
with Planning/Itinerary tabs, a sample "Allison & Chard take on Spain" itinerary
with day stops (kind chips, costs, booking refs), and two floating badges
("Optimized · 1h 54m saved", "Shared with your party"). Styles in
`styles/landing.css` (`.hero*`, `.heroapp*`). The headline 2nd line, eyebrow,
accent color, and stat-row visibility are wired to the Tweaks panel (below).

## Tweaks panel (optional — prototype-only authoring tool)

`scripts/landing-tweaks.jsx` + `tweaks-panel.jsx` mount a small React control panel
(only visible when the prototype host enables "edit mode") that live-edits: accent
color (4 swatches), hero 2nd-line headline (4 options), eyebrow text, and hero-stat
visibility. **This is an authoring aid for the prototype, not a product feature —
you can omit it from the real implementation** unless the team wants a theming
control.

---

## Naming

The prototype chrome (logo, nav, footer, some pricing copy) still reads
**"GuideMe"**, the working name. The product's real name is **"YunHai"** and the
hero copy already uses it. **A full GuideMe → YunHai rename is pending and was not
completed in the prototype** — when implementing, use **YunHai** throughout. Confirm
the exact wordmark treatment (one word "YunHai"; whether to keep an italic-serif
flourish) with the team.

---

## Interactions & Behavior summary

- **Trigger:** each demo plays once automatically when ≥50% scrolled into view;
  a **Replay** button re-runs it. While playing, Replay is disabled/dimmed.
- **No user input drives the demos** — they are guided auto-playing animations
  (per product direction). Keep them non-interactive except for Replay.
- **Reduced motion:** the prototype does not yet special-case
  `prefers-reduced-motion`. Recommended: when set, skip animation and render each
  demo in its **final/end state** (profile filled + signal saved; timeline full
  with totals; itinerary with file attached + tools done).
- **Timing source of truth:** the `tl.at(ms, …)` calls in each controller. Reuse
  these offsets when rebuilding so pacing matches.

## State (per demo, if modeling as a state machine)

- **Demo 01:** `answeredCount (0–4)`, `phase: building | summarizing | ready |
  signal-typing | saving | saved`, `signalChipAdded: bool`, `whyText: base | new`.
- **Demo 02:** `paceIndex (0–4, target 2)`, `phase: pref | filling | done`,
  `placedStops (0–4)`, `transitTotalMins (0→114)`.
- **Demo 03:** `cursorPos`, `uploadProgress (0–100)`, `uploadDone: bool`,
  `fileAttached: bool`, `filesOpen: bool`, `tools: {gcal, share, pdf}: done bool`.

## Files in this bundle

- `Landing.html` — the full page (search `data-demo="personalize|sequence|organize"`
  for the three demo blocks; markup is the source of truth for structure/copy).
- `styles/tokens.css` — all design tokens + base resets.
- `styles/landing.css` — hero + chapter shell + shared demo-frame chrome.
- `styles/landing-demos.css` — shared `.chapter` / `.demo` chrome.
- `styles/landing-demo-profile.css` + `scripts/landing-demo-profile.js` — **Demo 01**.
- `styles/landing-demo-sequence.css` + `scripts/landing-demo-sequence.js` — **Demo 02**.
- `styles/landing-demo-organize.css` + `scripts/landing-demo-organize.js` — **Demo 03**.

## Assets

No external image/font binaries are bundled. Fonts (Geist, Geist Mono, Instrument
Serif) are referenced by family name — wire them up via your app's font pipeline
(self-hosted or Google Fonts). All iconography in the demos is **inline SVG**
(plane, clock, bus/transit, calendar, share-nodes, download, file, checkmark,
cursor arrow) — lift them from the markup or swap for your codebase's icon set.
Activity/shrine "photos" are CSS gradient placeholders, not real images.
