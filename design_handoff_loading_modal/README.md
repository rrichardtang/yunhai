# Handoff: Trip-Planning Loading Modal

## Overview
A full-screen overlay shown while the app generates a trip itinerary — it appears
**between the Setup step and the Review step**. It reassures the user that work is
happening, names the trip and city being planned, shows coarse progress, and cycles
through a series of lighthearted status messages.

This is a redesign of an existing plain-text modal. The new version adds **character
and motion**: an animated wireframe globe with a small plane orbiting it along a
dotted flight route, plus a cleaner type hierarchy.

## About the Design Files
The file in this bundle (`loading-modal-preview.html`) is a **design reference created
in HTML** — a self-contained prototype showing the intended look and animation. It is
**not** production code to drop in verbatim. The task is to **recreate this design in the
target codebase using its established patterns** (component framework, styling system,
existing tokens). If the project has no front-end environment yet, pick the most
appropriate framework and implement it there.

> Note: this design originated as edits to an existing vanilla-JS app (`app.js` +
> `styles.css`). Those exact edits are reproduced below in **Reference Implementation**,
> so if your codebase is similar you can lift them directly. Otherwise, treat them as a
> spec.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, and animation timings are
all specified below and should be reproduced precisely.

---

## Screen: Planning Overlay

### Purpose
Block interaction and communicate progress while the itinerary is being generated.
Dismissed automatically by the app when planning completes (it then advances to Review).

### Layout
- **Backdrop** (`.planning-overlay`): `position: fixed; inset: 0`, full-viewport flex
  container, `align-items: center; justify-content: center`, `padding: 20px`.
  Background `rgba(11, 37, 69, .62)` with `backdrop-filter: blur(8px)`. `z-index: 1800`.
- **Card** (`.planning-overlay-card`): centered, `width: min(440px, 100%)`,
  `padding: 6px 36px 40px`, `border-radius: 28px`, `overflow: hidden`, centered text.
  Single column, natural document flow, in order:
  1. Globe animation (220px wide, self-centered)
  2. Trip name — small uppercase kicker
  3. City status — bold hero line
  4. Progress — pill
  5. Rotating status message — accent blue

### Components

**1. Card container**
- Background (two layers):
  - `radial-gradient(120% 80% at 50% -12%, rgba(42,125,225,.30), transparent 60%)`
  - `linear-gradient(160deg, #103a72 0%, #0b2545 56%, #081b34 100%)`
- Border: `1px solid rgba(245,240,235,.08)`
- Box-shadow: `0 30px 80px rgba(8,20,40,.55), inset 0 1px 0 rgba(245,240,235,.06)`
- Entrance animation: `planningCardIn .5s cubic-bezier(.2,.8,.2,1) both`

**2. Globe scene** (`.planning-globe`, 220px wide, `margin: 4px auto -4px`)
An inline SVG, `viewBox="0 0 220 150"`. Composed only of circles, ellipses, lines and
two short paths (no raster art). Globe center is `(110, 78)`, radius `52`.
- Atmosphere glow: `<circle r=72>` filled with a radial gradient
  (`rgba(42,125,225,.55)` → transparent).
- Ocean sphere: `<circle r=52>` filled with radial gradient
  `#5aa2f2` (38%/30%) → `#1c5fae` (52%) → `#0b2c58` (100%).
- Wireframe (clipped to the sphere, `stroke: rgba(245,240,235,.22)`, `stroke-width: 1`):
  vertical meridians (ellipses `rx=18` and `rx=38`, `ry=52`) + center line;
  latitudes (ellipses `rx=52`, `ry=20` and `ry=40`) + equator line.
- Sheen highlight: a faint rotated ellipse top-left, `rgba(245,240,235,.16)`.
- **Flight route** (`.orbit-route`): a `<path>` describing a tilted ellipse around the
  globe (`rx=86, ry=24`), `fill: none`, `stroke: rgba(109,176,255,.6)`,
  `stroke-width: 1.4`, `stroke-dasharray: 1 7`, `stroke-linecap: round`. The whole
  route + plane group is wrapped in `transform="rotate(-13 110 78)"` for a jaunty tilt.
- **Plane** (`.plane`): a small paper-plane glyph `<path>`, `fill: #F7F3EE`,
  `stroke: #0b2c58`, `stroke-width: .6`. It points right by default so `offset-rotate`
  orients it along the route.

**3. Trip name** (`.planning-trip`, hook: `data-trip-name`)
- `font-size: .72rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase`
- `color: rgba(245,240,235,.6); margin-bottom: 14px`
- Content example: `Planning your trip to Japan`

**4. City status** (`.planning-status`, hook: `data-city-status`)
- `font-size: 1.5rem; font-weight: 800; letter-spacing: -.01em; line-height: 1.15`
- `color: var(--text-on-dark)` (`#F5F0EB`); `margin-bottom: 14px`
- Content example: `Planning Tokyo, Japan…`

**5. Progress pill** (`.planning-progress`, hook: `data-progress`)
- `display: inline-block; font-size: .8rem; font-weight: 600; letter-spacing: .02em`
- `color: rgba(245,240,235,.78)`; `background: rgba(245,240,235,.08)`;
  `border: 1px solid rgba(245,240,235,.1)`; `padding: 5px 14px`;
  `border-radius: 999px`; `margin-bottom: 18px`
- `.planning-progress:empty { display: none; }` — hides the pill until progress text exists
- Content example: `City 0 of 1 done`

**6. Rotating message** (`.planning-message`, hook: `data-loading-message`)
- `font-size: 1.05rem; font-weight: 600; color: #6db0ff; min-height: 1.4em`
- Fades/slides between messages: `opacity` 0↔1, `transform: translateY(6px)↔0`,
  `transition: opacity .45s ease, transform .45s ease`.
- Visible state is toggled with the `loading-visible` class (see Interactions).
- Content example: `Checking sunset times…`

---

## Interactions & Behavior

### Showing / hiding
- Show: remove a `hidden` class on the overlay when planning starts; the card plays its
  entrance animation. Hide when the planning stream completes, then navigate to Review.
- The overlay blocks all interaction beneath it (full-screen, blurred backdrop).

### Dynamic text (driven by the planning process)
- `data-trip-name` ← `Planning your trip to ${tripName}`
- `data-city-status` ← e.g. `Planning ${cityName}…` / `Starting planning…`
- `data-progress` ← e.g. `City 0 of N done` (empty string hides the pill)
- `data-loading-message` ← cycles through a fixed list every **2400ms**:
  on each tick, remove `loading-visible` (fade out), wait ~140–250ms, swap the text,
  re-add `loading-visible` (fade in). Index wraps with modulo.

### Animations (all CSS; durations/easings are exact)
| Name | Target | Spec |
|---|---|---|
| `planeOrbit` | `.plane` | `offset-distance: 0 → 100%`, **6s linear infinite** |
| `planeFade` | `.plane` | opacity dips to `.18` while behind the globe — keyframes `0%,46%{1} 56%,82%{.18} 92%,100%{1}`, **6s linear infinite** |
| `routeFlow` | `.orbit-route` | `stroke-dashoffset: 0 → -8`, **1.1s linear infinite** (dots flow along the route) |
| `globeFloat` | `.globe-svg` | `translateY 0 → -5px → 0`, **5s ease-in-out infinite** (gentle bob) |
| `planningCardIn` | card | `opacity 0→1`, `translateY(14px) scale(.97) → none`, **.5s** `cubic-bezier(.2,.8,.2,1)` |

**Plane motion technique:** CSS Motion Path. The plane element gets
`offset-path: path('M196,78 A86,24 0 1,1 24,78 A86,24 0 1,1 196,78')` and
`offset-rotate: auto`, animated via `offset-distance`. This is the same ellipse as the
visible `.orbit-route` path, so the plane rides exactly on the dotted line. Both sit
inside the `rotate(-13 …)` group so they tilt together.
> If your platform lacks CSS Motion Path (e.g. some native targets), replicate by
> animating the plane along the parametric ellipse:
> `x = 110 + 86·cos θ`, `y = 78 + 24·sin θ`, then apply the -13° group rotation, and set
> the plane's heading to the path tangent.

### Reduced motion
Respect `prefers-reduced-motion: reduce` — disable `globeFloat`, `routeFlow`,
`planeOrbit`, `planeFade`, and the card entrance (`animation: none`). The plane should
come to rest somewhere on the route; the modal stays fully legible and functional.

---

## State Management
- `isPlanning: boolean` — gates showing the overlay; prevents double-trigger.
- `tripName`, current `cityName`, `completedCities`, `totalCities` — feed the text hooks.
- A repeating timer (2400ms) for the rotating message; **clear it when the overlay hides**
  and reset the message index to 0.
- Overlay visibility toggled via a `hidden` class (not unmount), so the card entrance
  animation replays each time it's shown.

## Design Tokens
**Colors**
| Token | Value | Use |
|---|---|---|
| Card gradient top | `#103a72` | card bg start |
| Card gradient mid | `#0b2545` | card bg / brand navy |
| Card gradient bottom | `#081b34` | card bg end |
| Accent blue | `#2A7DE1` / `rgba(42,125,225,…)` | glow, route |
| Light route stroke | `rgba(109,176,255,.6)` | flight path |
| Message blue | `#6db0ff` | rotating status |
| Text on dark | `#F5F0EB` (`--text-on-dark`) | status line |
| Globe ocean | `#5aa2f2 → #1c5fae → #0b2c58` | sphere gradient |
| Globe deep / plane stroke | `#0b2c58` | meridian-clipped sphere edge, plane outline |
| Plane fill | `#F7F3EE` | plane body |
| Wireframe / pill borders | `rgba(245,240,235,.08–.22)` | lines, pill, card border |
| Backdrop | `rgba(11,37,69,.62)` + `blur(8px)` | overlay scrim |

**Radius:** card `28px`, pill `999px`.
**Type scale (modal):** `.72rem` kicker / `1.5rem` status / `.8rem` pill / `1.05rem` message.
Font family inherits the app's UI sans (system stack in the preview).
**Timing:** plane 6s, route 1.1s, globe 5s, card 0.5s, message swap every 2.4s, text fade 0.45s.

## Assets
None external. The globe and plane are **inline SVG primitives** (circles, ellipses,
lines, two short paths) — no images, icon fonts, or raster files. Copy the SVG markup
verbatim from `loading-modal-preview.html`.

## Files
- `loading-modal-preview.html` — self-contained, runnable design reference (open in a
  browser to see the animation; it includes a small script that cycles the status line).

---

## Reference Implementation (vanilla JS / CSS source)
The original app is plain JS + CSS. These are the exact edits made; reuse or adapt.

### Markup (injected into the overlay card)
The overlay card contains the globe SVG followed by four text nodes carrying the data
hooks. See `loading-modal-preview.html` for the complete, copy-pasteable markup
(`.planning-globe` SVG + `[data-trip-name]`, `[data-city-status]`, `[data-progress]`,
`[data-loading-message]`).

### CSS
All `.planning-*`, `.globe-svg`, `.orbit-route`, `.plane` rules and the five
`@keyframes` blocks live in the preview file's `<style>` and are production-ready.
The only project-specific token is `--text-on-dark: #F5F0EB`.

### JS contract (unchanged from existing app)
Keep these four attribute hooks so existing update logic keeps working:
`data-trip-name`, `data-city-status`, `data-progress`, `data-loading-message`, plus the
`loading-visible` class toggled on the message for the fade.
