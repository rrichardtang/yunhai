# DEMO_BUILD: The GuideMe Landing-Page Reel

This document explains exactly how the in-page product demo on the landing page works and how to rebuild it in your codebase. The goal of the demo is to show prospects the **real app in action**, not a fabricated marketing animation — every click, every keystroke happens against the actual UI.

---

## 1. The big idea

Instead of pre-rendered video or a hand-drawn animation, the demo:

1. Embeds the real product screens as `<iframe>` elements inside a browser-chrome wrapper.
2. Reaches into each iframe's same-origin DOM at scripted timestamps and:
   - **moves a synthetic cursor** to specific elements (computed from `getBoundingClientRect()`),
   - **fires real clicks** via `element.click()`,
   - **types real text** by dispatching `input` events character by character,
   - **sets form values** (date/time/select) directly with dispatched `input`/`change` events.
3. Crossfades a glassmorphic "narrator" card in one of the four viewport corners, repositioned per substep so it never sits where the action is.

Because the iframes load the real screens, the demo's fidelity is 100% — if you redesign Setup tomorrow, the demo updates automatically.

### Hard requirements

- **Same-origin iframes.** The engine reads `iframe.contentDocument` and writes to its inputs. Cross-origin iframes will throw. Keep your demo screens on the same origin as the marketing page, or proxy them.
- **The real screens need stable selectors.** The Setup beat targets things like `.cities-tool .stool-btn.add`, `.setup-foot .gm-btn--primary`, and `[data-demo-new] [data-dm="city"]`. Either keep your selectors stable, or let the demo inject the elements it needs (the current implementation does both — it manipulates real Setup elements and injects a temporary "demo" city card with `data-demo-new`).
- **Reasonable iframe sizing.** The engine designs at `1440 × 880`. It applies `transform: scale(N)` to the iframe and `width/height: 1440px/880px` so the scaled element exactly covers the viewport. Make sure your screens render correctly at 1440×880; clip/scroll if larger.

---

## 2. File layout

```
Landing.html                  the page (loads everything)
styles/
  tokens.css                  design tokens
  landing.css                 page layout, nav, hero, marquee, footer
  landing-demo.css            ← reel: browser frame, viewport, cursor, narrator, dots
  landing-pricing.css         pricing section
scripts/
  landing-reel.js             ← the engine
Setup.html                    the screen that the scripted Setup beat drives
ProfileWizard.html            (scroll tour)
Planner.html                  (scroll tour)
Arrange.html                  (scroll tour)
Finalize.html                 (scroll tour)
Itinerary.html                (scroll tour)
```

Load order in `Landing.html`:

```html
<link rel="stylesheet" href="styles/tokens.css">
<link rel="stylesheet" href="styles/landing.css">
<link rel="stylesheet" href="styles/landing-demo.css">
<link rel="stylesheet" href="styles/landing-pricing.css">
...
<script src="scripts/landing-reel.js"></script>
```

The script is a single IIFE with no exports — it self-attaches to DOM elements with known IDs.

---

## 3. The DOM scaffold

In `Landing.html`, the reel section looks like this. **Every ID matters** — the engine queries them directly.

```html
<section class="reel" id="reel">
  <div class="reel__head">
    <div>
      <span class="gm-eyebrow">See it in motion</span>
      <h2>The product, <span class="serif">actually</span> running.</h2>
    </div>
    <p class="reel__lede">Every frame below is the live app — no mockups, no after-effects…</p>
  </div>

  <div class="reel__stage">
    <div class="reel__browser">
      <!-- Browser chrome: lights + URL bar + play/pause + progress -->
      <div class="reel__chrome">
        <div class="reel__lights"><span></span><span></span><span></span></div>
        <div class="reel__urlbar">
          <svg>…lock icon…</svg>
          <span>
            <span class="reel__url-host">guideme.app</span>
            <span class="reel__url-path" id="reelUrlPath">/setup</span>
          </span>
        </div>
        <div class="reel__chrome-right">
          <button class="reel__playbtn" id="reelPlayPause" type="button">
            <svg id="reelPlayIcon">…pause icon…</svg>
          </button>
        </div>
        <div class="reel__progress">
          <div class="reel__progress-bar" id="reelProgress"></div>
        </div>
      </div>

      <!-- The actual viewport -->
      <div class="reel__viewport is-loading" id="reelViewport">
        <div class="reel__frames" id="reelFrames">
          <!-- iframes injected by JS -->
        </div>

        <!-- Synthetic cursor -->
        <div class="reel__cursor" id="reelCursor" style="left: 50%; top: 50%; opacity: 0;">
          <svg>…arrow…</svg>
        </div>

        <!-- Narrator card (floats inside viewport, repositions per substep) -->
        <aside class="reel__narrator pos-br" id="reelNarrator" aria-live="polite">
          <div class="reel__narrator-rule"></div>
          <div class="reel__narrator-body">
            <div class="reel__narrator-label" id="reelNarratorLabel">Step 01 of 07 · Setup</div>
            <h3 class="reel__narrator-title" id="reelNarratorTitle">Build the trip, leg by leg.</h3>
            <p class="reel__narrator-text" id="reelNarratorText">…</p>
          </div>
        </aside>
      </div>
    </div>

    <!-- 6 step dots -->
    <div class="reel__dots" id="reelDots"></div>
  </div>
</section>
```

Required IDs the engine reads:

| ID | Purpose |
| --- | --- |
| `reel` | Outer section, observed for intersection-pause |
| `reelViewport` | The iframe container; provides the viewport-relative coordinate system |
| `reelFrames` | iframes are appended here |
| `reelCursor` | Synthetic cursor (positioned in viewport pixel coordinates) |
| `reelNarrator` | Narrator card root; receives `.pos-tl/tr/bl/br` |
| `reelNarratorLabel/Title/Text` | Content slots |
| `reelProgress` | Progress bar fill |
| `reelUrlPath` | URL path text in the browser chrome |
| `reelDots` | Container; dots injected by JS |
| `reelPlayPause` + `reelPlayIcon` | Play/pause button + its SVG paths |

---

## 4. The engine

Inside `scripts/landing-reel.js`, the whole thing is structured as:

```
const BEATS = [ { src, path, step, caption, dur, run: async (eng) => {…} }, … ];

class Engine {
  narrate(label, title, text, corner?)
  cursorTo(selector|element, opts)
  click(selector, opts)
  type(selector, text, opts)
  setValue(selector, value, opts)
  custom(async fn)
  scrollTo(el, padding)
  wait(ms)
}

// Boot: wire DOM, build iframes + dots, call goTo(0)
```

### 4.1 `Engine.cursorTo(selector, opts)`

```js
async cursorTo(selector, opts = {}) {
  const el = typeof selector === 'string' ? this.doc.querySelector(selector) : selector;
  if (!el) return null;
  if (opts.scroll !== false) await this.scrollTo(el, opts.padding || 160);
  const r = el.getBoundingClientRect();
  // r is in iframe-document coordinates → scale to viewport pixels
  const cx = (r.left + r.width / 2 + (opts.dx || 0)) * this.scale;
  const cy = (r.top  + r.height / 2 + (opts.dy || 0)) * this.scale;
  this.cursor.style.opacity = '1';
  this.cursor.style.left = cx + 'px';
  this.cursor.style.top  = cy + 'px';
  await this.wait(opts.travel || 750);
  return el;
}
```

Why `* this.scale`: the iframe is scaled by `transform: scale(N)`, so the iframe-document coordinate `(r.left, r.top)` lives at viewport pixel `(r.left*N, r.top*N)`. The cursor is a sibling of the iframe inside `.reel__viewport`, so we position it in viewport coordinates.

The cursor itself has a CSS transition on `left/top`:

```css
.reel__cursor {
  transition: left 1100ms cubic-bezier(.5,0,.15,1),
              top  1100ms cubic-bezier(.5,0,.15,1),
              opacity 350ms ease;
  transform: translate(-2px, -2px); /* anchor at the cursor tip */
}
```

### 4.2 `Engine.click(selector, opts)`

```js
async click(selector, opts = {}) {
  const el = await this.cursorTo(selector, opts);
  if (!el) return null;
  this.cursor.classList.add('is-clicking');     // triggers ripple animation
  await this.wait(160);
  el.click();                                    // real click
  await this.wait(opts.after || 480);
  this.cursor.classList.remove('is-clicking');
  return el;
}
```

The ripple is a CSS `::after` pseudo on `.reel__cursor.is-clicking`:

```css
.reel__cursor.is-clicking::after {
  content: ''; position: absolute; left: 6px; top: 6px;
  width: 8px; height: 8px; border-radius: 50%;
  border: 2px solid var(--accent);
  animation: reelClickRipple 600ms var(--ease-out) forwards;
}
@keyframes reelClickRipple {
  0%   { width: 8px;  height: 8px;  opacity: .9; }
  100% { width: 44px; height: 44px; left: -12px; top: -12px; opacity: 0; }
}
```

### 4.3 `Engine.type(selector, text, opts)`

```js
async type(selector, text, opts = {}) {
  const el = this.doc.querySelector(selector);
  await this.cursorTo(el, { travel: opts.travel || 600 });
  el.focus();
  el.value = '';
  el.dispatchEvent(new Event('input', { bubbles: true }));
  const min = opts.speedMin ?? 35;
  const max = opts.speedMax ?? 70;
  for (const ch of text) {
    el.value += ch;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(min + Math.random() * (max - min));
  }
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
```

Per-character `input` events make controlled-component framework UIs (React/Vue) update correctly, just like a real human typing.

### 4.4 `Engine.setValue(selector, value, opts)`

For inputs where simulated keystrokes are wrong (date pickers, time pickers, selects), the engine sets the value directly and dispatches `input` + `change`. Used for `type="date"`, `type="time"`, and `<select>`.

### 4.5 `Engine.custom(fn)`

Escape hatch for arbitrary DOM work inside the iframe (resetting state at beat start, injecting the demo city card, updating header subtitles to reflect the new data, etc.).

```js
await eng.custom(async (doc, win, eng) => {
  doc.querySelector('.foo').textContent = 'bar';
});
```

### 4.6 `Engine.narrate(label, title, text, corner?)`

Crossfades the narrator card's content. If `corner` is passed (`'tl' | 'tr' | 'bl' | 'br'`), the card also slides to that corner via CSS transitions on `left/right/top/bottom`. Corners are picked per substep to stay opposite the active cursor zone — see §6.

### 4.7 Cancellation

The engine uses an integer `runToken`. `goTo()` increments it and sets `engine.cancelled = true`. All async methods check `this.cancelled` between steps and bail. This is essential — without it, switching beats while one is mid-flight leaves stale timeouts firing and the cursor jerks around.

---

## 5. The Beat schema

A beat is one screen in the demo. Each entry in `BEATS`:

```js
{
  src: 'Setup.html',          // iframe URL
  path: '/setup',             // shown in the browser URL bar
  step: '01 / SETUP',         // dot label
  caption: '…',               // (legacy — narrator replaces this)
  dur: 36000,                 // visual progress-bar duration (ms)
  run: async (eng) => {
    // sequence of cursorTo/click/type/setValue/custom/narrate
  },
}
```

`dur` controls the progress-bar fill rate. The real beat advances when `run()` resolves — they don't have to match, but for UX they should be close.

---

## 6. The Setup beat (fully scripted, 7 substeps)

This is the worked example you should copy when scripting other beats. Each substep starts with a `narrate(...)` call that updates the floating card.

### Substep 1 — Add City *(narrator: bottom-right)*

1. **Reset the iframe to a clean baseline** via `custom()`:
   - Remove any previous demo-injected nodes (`[data-demo-new]`).
   - Remove the original Setup file's city 2 & 3 so only Córdoba shows.
   - Collapse city 1.
   - Rewrite the trip arc and footer meta to reflect "1 city, 2 nights".
   - Scroll to top.
2. `narrate(...)` with copy explaining "a trip is a chain of cities; we'll add one".
3. `click('.cities-tool .stool-btn.add', { travel: 950, padding: 140 })` — moves cursor to the **Add city** button and fires its real click.
4. Inject a new empty city card via `custom()` with `data-demo-new="1"`, all field selectors tagged `[data-dm="..."]` so subsequent substeps can target them. The card has a 380ms fade-in. Wire its tab clicks inside the same custom() so they switch active panes.

### Substep 2 — City & dates *(narrator: bottom-right)*

1. `narrate(...)`.
2. `type('[data-demo-new] [data-dm="city"]', 'Seville, Spain')` — character-by-character.
3. `custom()` writes "Seville" + "Spain" into the card's header `<span>`s so the collapsed-card preview updates live.
4. `setValue('[data-demo-new] [data-dm="checkin"]', '2026-04-26')` — date input.
5. Same for `checkout` → `2026-04-30`.
6. `custom()` updates the city's date pill ("04/26 → 04/30 · 4 nights"), the field "Nights" readonly input, AND rewrites the trip arc to two stops (Córdoba + Seville) and footer meta.

### Substep 3 — Stay *(narrator: top-right)*

1. `narrate(...)`.
2. `type('[data-demo-new] [data-dm="address"]', 'Hotel Alfonso XIII, Plaza San Fernando 2')`.
3. `custom()` updates the city header sub: `Stay <b>Alfonso XIII</b> · Arrive <b>—</b>`.

### Substep 4 — Arrival *(narrator: top-right)*

1. `narrate(...)`.
2. `click('[data-demo-new] [data-dm-tab="arrival"]')` — switches the panel to Arrival.
3. `type('[data-demo-new] [data-dm="arriveLoc"]', 'Estación Sevilla-Santa Justa')`.
4. `setValue('[data-demo-new] [data-dm="arriveTime"]', '11:05')`.
5. `custom()` updates the header sub to `Arrive <b>11:05 train</b>` and marks the Arrival tab `.has-data`.

### Substep 5 — Departure *(narrator: top-left)* — moves to avoid the form

1. `narrate(...)`.
2. `click('[data-demo-new] [data-dm-tab="departure"]')`.
3. `type(... departLoc, 'Estación de Autobuses Plaza de Armas', { speedMin: 28, speedMax: 55 })` — faster typing on the longer string keeps total beat length tight.
4. `setValue(... departTime, '06:30')`.
5. `setValue(... departMode, 'Bus')` — selects from `<select>`.
6. `custom()` marks Departure tab `.has-data`.

### Substep 6 — Notes *(narrator: top-right)*

1. `narrate(...)`.
2. `click('[data-demo-new] [data-dm-tab="notes"]')`.
3. `type(... notes, 'Flamenco at La Carbonería on Apr 28. …')` — long string, slowed-down speed (24-50ms per char).
4. `custom()` marks Notes tab `.has-data` and bumps footer meta to "2 of 2 fully filled".

### Substep 7 — Save & continue *(narrator: top-left)*

1. `narrate(...)` with downstream-flow recap copy.
2. `click('.setup-foot .gm-btn--primary', { travel: 1100, padding: 220 })` — moves cursor across the page to the **Continue to Review →** button.

After `run()` resolves, the engine auto-advances to the next beat (`Profile`).

---

## 7. The narrator card

```html
<aside class="reel__narrator pos-br" id="reelNarrator" aria-live="polite">
  <div class="reel__narrator-rule"></div>
  <div class="reel__narrator-body">
    <div class="reel__narrator-label" id="reelNarratorLabel">…</div>
    <h3 class="reel__narrator-title" id="reelNarratorTitle">…</h3>
    <p class="reel__narrator-text" id="reelNarratorText">…</p>
  </div>
</aside>
```

- Positioned `absolute` inside `.reel__viewport`. Width `min(360px, calc(100% - 44px))`.
- Dark `rgba(10,22,40,0.86)` background with `backdrop-filter: blur(14px) saturate(140%)` for the glass effect.
- 3px accent rail on the left.
- Four corner classes provide the layout positions:

```css
.reel__narrator.pos-tl { left: 22px;  top: 22px;    right: auto; bottom: auto; }
.reel__narrator.pos-tr { right: 22px; top: 22px;    left: auto;  bottom: auto; }
.reel__narrator.pos-bl { left: 22px;  bottom: 22px; right: auto; top: auto; }
.reel__narrator.pos-br { right: 22px; bottom: 22px; left: auto;  top: auto; }
```

Transition: `left, right, top, bottom 360ms var(--ease-out)`. When `Engine.narrate()` is called with a corner, it removes all four classes and adds the new one — the card slides smoothly.

The body crossfades content (220ms `.is-out` → swap text → remove `.is-out`).

### Corner choice heuristic

Pick the corner farthest from the cursor's active zone for that substep:

| Cursor working area | Narrator corner |
| --- | --- |
| Top toolbar / city header | `br` (bottom-right) |
| Top of new card body | `br` |
| Mid-card form fields (left) | `tr` |
| Right-side form column | `tl` |
| Footer / bottom CTA | `tl` |
| Center of screen (long scroll) | `br` or `bl` |

Don't be precious — vary the corner across substeps for visual interest even if multiple substeps would technically fit the same corner.

---

## 8. The browser chrome

```html
<div class="reel__chrome">
  <div class="reel__lights"><span></span><span></span><span></span></div>
  <div class="reel__urlbar">
    <svg>…lock…</svg>
    <span><span class="reel__url-host">guideme.app</span><span class="reel__url-path">/setup</span></span>
  </div>
  <div class="reel__chrome-right">
    <button class="reel__playbtn">…</button>
  </div>
  <div class="reel__progress"><div class="reel__progress-bar"></div></div>
</div>
```

- 44px tall, soft gradient `#F8F5F0 → #ECE8E1`, hairline bottom border.
- The URL bar is `position: absolute; left: 50%; transform: translate(-50%,-50%)` so it stays visually centered regardless of how wide the right cluster gets.
- The play/pause button is `var(--ink-900)` 28px circle with a white play/pause icon.
- The progress bar is `position: absolute; left: 0; bottom: -1px; height: 2px` and overlaps the chrome's bottom hairline — feels like a scrubber.

---

## 9. Scaling math

```js
function rescale() {
  const w = viewport.clientWidth;
  const s = w / FRAME_W;            // FRAME_W = 1440
  engine.setScale(s);
  iframes.forEach((f) => {
    f.style.transform = 'scale(' + s + ')';
    f.style.width  = FRAME_W + 'px';
    f.style.height = FRAME_H + 'px';
  });
}
new ResizeObserver(rescale).observe(viewport);
```

Why this approach (instead of e.g. `width: 100%` on the iframe): the inner page is designed at 1440×880. If we let the iframe fluid-resize, the page's responsive breakpoints kick in and break the demo aesthetic at smaller widths. Designing at a fixed canvas and scaling preserves the desktop layout at every viewport.

---

## 10. Beat lifecycle

```
goTo(i):
  runToken += 1           // invalidate any in-flight run
  engine.cancelled = true
  await sleep(60)          // give the previous run() a tick to bail
  engine.cancelled = false

  // swap active iframe
  iframes.forEach((f, k) => f.classList.toggle('is-active', k === i));
  engine.setIframe(iframes[i]);

  urlPath.textContent = beat.path;
  dots.forEach((d, k) => d.classList.toggle('is-active', k === i));

  await ensureLoaded(iframes[i]);   // resolves on first 'load' event
  if (runToken changed) return;

  beatStart = performance.now();
  beatDur   = beat.dur;
  if (!raf && playing) raf = requestAnimationFrame(tick);

  await beat.run(engine);

  if (still our token && playing) goTo(idx + 1);
```

The `tick()` loop only updates the progress bar fill; advancement happens via `beat.run()` resolving.

---

## 11. Pause / resume

- **Manual**: the play button toggles `playing`, cancels the runToken, halts `raf`. Replay resumes by re-calling `goTo(idx)`.
- **Off-screen**: an `IntersectionObserver` on `#reel` (threshold 0.15) pauses when the section scrolls out of view and resumes when it comes back. This saves a lot of CPU on long pages where the iframes would otherwise keep animating.

---

## 12. Building this in production

A reasonable React port:

```
components/
  Reel/
    Reel.tsx               (the component — owns DOM refs)
    ReelEngine.ts          (the Engine class, framework-free)
    beats/
      index.ts             (BEATS array, imports each beat)
      setup.ts             (one async function per beat)
      profile.ts
      planner.ts
      …
    Reel.module.css        (port of landing-demo.css)
```

- `Reel.tsx` should be entirely uncontrolled internally — pass it the BEATS array as a prop, hold a single `currentBeatIdx` state, and never re-render mid-beat. The engine mutates DOM directly via refs.
- `ReelEngine` doesn't need to know about React; it takes element refs in its constructor.
- Put each beat's `run()` in its own file. Setup is ~120 lines; the others are ~25 lines each.
- Keep the `data-demo-new` / `[data-dm="..."]` convention. The injected demo card is your one safe handhold — the rest of Setup can refactor freely as long as the top-level selectors stay.
- Drive the iframe `src` from your router (`/embed/setup`, `/embed/profile`, etc.) and consider hiding the topbar nav inside those routes with a `?embed=1` query, so the demo doesn't show "Profile" page chrome twice.

### Selector hygiene

Add `data-demo-anchor` attributes to every element the reel targets:

```jsx
<button className="add-city-btn" data-demo-anchor="setup.add-city">Add city</button>
```

Then in the engine, use `[data-demo-anchor="setup.add-city"]` instead of `.cities-tool .stool-btn.add`. This decouples the demo from the visual class names so designers can rename freely.

### Testing the demo

Two failure modes to watch:

1. **Selector drift.** A real-app rename breaks a beat. Add a small Storybook story or Playwright check that loads each iframe and asserts every demo selector resolves.
2. **Race on iframe load.** If you `goTo()` before the iframe has fired `load`, `querySelector` returns null. Always `await ensureLoaded(f)` before touching the document.

### Accessibility

- The reel is decorative content. `aria-hidden="true"` on the iframes, `tabindex="-1"`, no focus traps.
- The narrator card uses `aria-live="polite"` so screen readers announce substep changes if the section is in view.
- Provide a non-animated alternative for users with `prefers-reduced-motion: reduce` — either show a static screenshot or skip the cursor/transitions and just narrate.
- The play/pause button is keyboard-focusable. Add keyboard `← →` for prev/next beat.

---

## 13. Quick checklist for a new beat

1. Add an entry to `BEATS` with `src`, `path`, `step`, `dur`, and an empty `run`.
2. Add a step dot label string.
3. Write `run(eng)`:
   - First line: `await eng.custom(async (doc) => {...})` to reset the screen to a known clean state.
   - Wait a beat for the reset to settle.
   - Per substep: `narrate(label, title, text, corner)` → cursor/click/type/setValue calls → wait.
   - End with `await eng.click(...)` on whatever advances to the next screen, if applicable.
4. Tune corners so the narrator never blocks the active region.
5. Adjust `dur` to roughly match the time `run()` takes.

Done.
