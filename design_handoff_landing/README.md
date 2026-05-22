# Handoff: GuideMe Landing Page

## Overview

The GuideMe landing page is a single-page marketing site for the GuideMe travel planner. It ends with a unique, fully-scripted **in-app product demo** that drives the real app screens (running in iframes) so prospects see the product actually doing the work — not a fabricated marketing animation.

Section order:

1. **Nav** — logo, How it works / Pricing links, Sign in / Open app CTAs.
2. **Hero** — H1 + subhead, two CTAs (Start planning / See it in motion), trust strip (no card · 15-minute plan · share with party), animated 3-stop route stage with city pins and day cards.
3. **Marquee** — logo strip "Trusted by travelers from".
4. **Demo reel** (`#reel`) — macOS-style browser-chrome window showing the real app screens running, a synthetic cursor moving and clicking through the actual UI, and a floating narrator card explaining *what* the user is doing and *why*. **See `DEMO_BUILD.md` for the full build guide — this is the centerpiece of the page and the most novel piece of work.**
5. **Pricing** (`#pricing`) — Free vs Pro ($14.99/mo) plan cards with checklists, trust band (no lock-in / fair billing / .edu & nonprofits), and a 4-question FAQ.
6. **Footer** — 4 columns (brand, Product, Company, Legal) on dark background.

## About the Design Files

The files in this bundle are **design references created in HTML, CSS, and vanilla JS**. They are not production code to copy directly. The job is to recreate the layout, copy, interactions, and demo reel behavior inside the target codebase using its established framework and patterns (React/Vue/Svelte/etc. — your call). If no framework is in place yet, React with CSS Modules or Tailwind is a reasonable default given how the prototype is structured.

The HTML/CSS in this bundle is conventional and will translate cleanly into JSX/Vue templates. The one piece of real engineering is the demo reel engine in `scripts/landing-reel.js` — that file should be ported with care; see `DEMO_BUILD.md`.

## Fidelity

**High-fidelity (hifi).** Final colors, typography, spacing, copy, and interactions are intended to ship as-is. Use the exact hex values from `styles/tokens.css` and the font stacks listed below.

## Design Tokens

All tokens live in `styles/tokens.css`. The full file is in this bundle — these are the highlights:

### Colors

| Token | Hex | Usage |
| --- | --- | --- |
| `--ink-abyss` | `#070B12` | deepest anchor, blackout |
| `--ink-900` | `#0A1628` | primary dark — rails, footers, Pro plan card bg |
| `--ink-800` | `#112240` | hover on dark surfaces |
| `--ink-700` | `#1B2A47` | elevated dark, Pro card border |
| `--paper-0` | `#F4F1EC` | page background (warm ivory) |
| `--paper-1` | `#FAF8F4` | card surface |
| `--paper-2` | `#EEEAE3` | alternating section bg |
| `--paper-3` | `#E2DED6` | muted elevated |
| `--text-900` | `#0A1628` | headings |
| `--text-700` | `#1E293B` | body |
| `--text-500` | `#5A6679` | muted / metadata |
| `--text-400` | `#8490A3` | placeholder |
| `--accent` | `#2F7DFB` | electric ocean (primary brand accent) |
| `--accent-hover` | `#1D6DE8` | |
| `--accent-soft` | `#E6EFFE` | tinted background |
| `--accent-deep` | `#0B4AB8` | high-contrast on tinted bg |
| `--ok` | `#1F9D55` | success (Free plan checks, trust dots) |
| `--warn` | `#C08B10` | |
| `--err` | `#C0362C` | |
| `--hair` | `rgba(10,22,40,.08)` | hairline borders |
| `--hair-strong` | `rgba(10,22,40,.14)` | stronger borders |
| `--hair-dark` | `rgba(244,241,236,.10)` | hairlines on dark |

### Typography

```css
--font-sans: 'Geist', 'Inter', 'Söhne', system-ui, -apple-system, sans-serif;
--font-display: 'Instrument Serif', 'Cormorant Garamond', Georgia, serif;
--font-mono: 'Geist Mono', 'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace;
```

`Instrument Serif` (italic) is used for single emphasized words inside sans-serif headings — e.g. *actually*, *honest*, *frequent*. Mono is used for eyebrows, step labels, prices, URLs, and any technical metadata.

Body base: 15px / 1.55, Geist 400. Headings: Geist 500–600, letter-spacing −0.02 to −0.035em, line-height 1.02–1.18. Pricing display ("$14"): 52px / 500 / −0.035em tracking.

### Radii

```
--r-sm: 6px;  --r-md: 10px;  --r-lg: 16px;  --r-xl: 24px;  --r-pill: 999px;
```

### Shadow hierarchy

```
--sh-sm: 0 1px 2px rgba(10,22,40,.04), 0 1px 1px rgba(10,22,40,.03);
--sh-md: 0 4px 18px rgba(10,22,40,.06), 0 2px 6px rgba(10,22,40,.04);
--sh-lg: 0 24px 60px rgba(10,22,40,.12), 0 8px 20px rgba(10,22,40,.06);
--sh-glow: 0 0 0 1px rgba(47,125,251,.25), 0 10px 40px rgba(47,125,251,.18);
```

### Motion

```
--ease-out:   cubic-bezier(.2, .8, .2, 1);
--ease-inout: cubic-bezier(.65, 0, .35, 1);
--dur-fast: 140ms;  --dur-med: 280ms;  --dur-slow: 520ms;
```

### Layout

```
--maxw: 1240px;   --gutter: clamp(16px, 3.4vw, 40px);
```

## Sections

### Nav (`.nav`)

- Full-width, ivory `--paper-0` background, sticky-feeling without actually being sticky.
- 60px tall. Logo left, link cluster center, CTA cluster right.
- Logo: SVG mark (10.5px-radius circle with horizontal line and accent center dot) + wordmark "Guide*me*" with "me" set in `Instrument Serif` italic.
- Links: 14px Geist 500, `--text-500`, hover → `--text-900`. Active page gets `--text-900`.
- "Sign in" → ghost button (1px `--hair-strong` border, transparent bg). "Open app →" → primary button (`--ink-900` bg, `--paper-0` text).

### Hero (`.hero`)

Two-column grid at `>900px`, single column below.

**Left column:**
- Eyebrow: animated dot + mono "Itinerary intelligence · v1.4"
- H1: `clamp(48px, 7vw, 84px)`, three lines, with `<span class="serif">actually</span>` italic in middle line.
- Subhead: 17px / 1.55 / max-width 520px / `--text-500`.
- CTAs: "Start planning" (accent button, blue) + "See it in motion" (ghost button, links to `#reel`).
- Trust strip: 3 inline items in mono, each with a green `--ok` dot — "Free to start · no card", "First plan in 15 minutes", "Share with your party".

**Right column ("Stage"):**
- Dark `--ink-900` 5:4.2 aspect box with rounded `--r-xl` corners, subtle grid background.
- Animated SVG route — a dashed `Q`-curve path with a pulsing accent dot animated along it via `<animateMotion>`.
- Three city pins (BCN, MAD, SVQ) with concentric stroke rings.
- AI status indicator top-center cycling through messages ("∴ plotting route · 3 cities", etc.) every 2.8s.
- Three day cards revealed in a stagger (600/1100/1600ms) — Day 01 Barcelona, Day 04 Madrid, Day 07 Seville.
- Corner microcopy in mono (TRIP/001, BCN→MAD→SVQ, 8 DAYS · 3 CITIES, "∴ BUILT IN 00:11").

### Marquee (`.marquee`)

Single line, mono label "Trusted by travelers from" + 6 wordmarks (Stripe, Notion, Figma, Linear, Ramp, Vercel) in `--text-400`. No animation — this is intentionally static.

### Demo Reel (`#reel`, `.reel`)

This is the centerpiece. **See `DEMO_BUILD.md` for the full build guide.** Briefly:

- macOS-style browser window frame with traffic lights, URL bar showing `guideme.app/<path>`, and a small play/pause button.
- A scrubber-style progress bar under the chrome.
- The viewport (16:9, `1440 × 880` design-time) contains an `<iframe>` per beat, each loading a real app screen (`Setup.html`, `ProfileWizard.html`, etc.).
- A synthetic cursor (SVG) moves over the iframe and triggers real clicks inside it.
- A floating dark glassmorphic narrator card explains each substep in plain English. It repositions across the four viewport corners between substeps so it never blocks what the cursor is doing.
- 6 step dots below the frame (Setup, Profile, Review, Arrange, Finalize, Ship It) — clickable for direct navigation.
- Setup is fully scripted with 7 substeps; the other 5 beats are scroll-tours with one narration each.

### Pricing (`#pricing`, `.pricing`)

- Centered head: eyebrow + H2 "Plan freely. Or plan *everything*." + subhead.
- Two-card grid (`920px` max-width, `1fr 1fr`, `24px` gap, stacks on mobile).
- **Free card** (`.plan--free`): ivory `--paper-1` bg, hairline border. Tier name + serif italic subtitle ("for the occasional traveler") + tag + $0/forever price block. Feature list with 6 green-check items and 3 muted "—" items (showing what's locked). Ghost CTA "Get started — it's free".
- **Pro card** (`.plan--pro`): dark `--ink-900` bg with subtle accent radial-gradient overlay, "Most planners pick this" pill badge clipped to top-right. Tier name + serif italic "for the *frequent* flyer" + tag + `$14.99/per month` price block. "Everything in Free, plus" mono divider + 8 accent-blue check items. Accent CTA "Start 14-day Pro trial".
- **Trust band**: 3-cell ivory card below the plans (no lock-in / fair billing / .edu & nonprofits).
- **FAQ**: 4 hairline-divided rows below trust band, each is a question + answer pair. Plain text, no accordion behavior — the answer is always visible.

### Footer (`.foot`)

- `--ink-900` background.
- 4-column grid (brand / Product / Company / Legal) on desktop, 2-col at `<700px`.
- Bottom row: copyright + "Plan with intention" tagline, hairline divider above.

## Interactions & Behavior

### Hero stage

- SVG route pulse uses native `<animateMotion>` along `<mpath href="#route">` with 3s duration, infinite repeat.
- AI status messages: an array of 4 messages, swapped via `setInterval` every 2800ms.
- Day cards: each has a `data-delay` attribute (600, 1100, 1600); a single setTimeout per card adds `.in` class which transitions opacity + translateY.

### Demo reel

See `DEMO_BUILD.md` — interactions are scripted per beat.

### Pricing

- No interactive behavior — the cards are static. Hover states only change borders.
- Free CTA → `Planner.html` (replace with your post-signup route). Pro CTA → `Planner.html` (replace with checkout flow).

### Scroll-reveal for hero/features

A single IntersectionObserver with `threshold: 0.1`. Elements start at `opacity: 0; transform: translateY(16px)` with a 700ms ease-out transition; on intersection, transform/opacity reset. (Currently only applied to a couple of element classes — extend or remove per your code style.)

## State Management

The landing page is mostly stateless. The only live state is in the demo reel — see `DEMO_BUILD.md`.

## Assets

- **Fonts**: All Google-hosted (Geist, Geist Mono, Instrument Serif). No self-hosted font files needed.
- **Logos in marquee**: text-only wordmarks, no image files.
- **Icons**: All inline SVGs in the markup (logo mark, button arrows, plan check/dash, browser chrome lock, cursor arrow). No icon library required.

## Files

The handoff folder ships:

- `README.md` (this file)
- `DEMO_BUILD.md` — deep-dive build guide for the reel
- `Landing.html` — the page source
- `styles/tokens.css` — design tokens (drop into your global stylesheet or theme)
- `styles/landing.css` — page-level layout for nav, hero, marquee, footer
- `styles/landing-demo.css` — demo reel styles (browser frame, viewport, cursor, narrator)
- `styles/landing-pricing.css` — pricing section styles
- `scripts/landing-reel.js` — the demo reel engine (port this carefully — see DEMO_BUILD.md)
- `Setup.html` — the screen that the fully-scripted Setup beat drives. Required for the demo to look like the real app. Note that `ProfileWizard.html`, `Planner.html`, `Arrange.html`, `Finalize.html`, `Itinerary.html` are also referenced but only need scroll-tours; you can stub them or point the iframe at your own routes.

## Porting Notes

- The whole page uses CSS custom properties throughout. If you're on Tailwind, generate a theme from `tokens.css` rather than hand-converting.
- All HTML is canonical (every element explicitly closed, attributes double-quoted) — straight JSX conversion will work.
- No CSS frameworks, no JS dependencies. The reel uses only the platform (`IntersectionObserver`, `ResizeObserver`, `requestAnimationFrame`).
- The page is responsive down to ~360px. Demo reel chrome shrinks gracefully; cards stack at 760px.
