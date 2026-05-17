# Handoff: Profile Wizard & Traveler Profile Modal

## Overview

A visual redesign of the **Profile Wizard** (first-run, multi-step onboarding to capture a traveler's preferences) and the **Traveler Profile modal** (the view a user gets when they click the topbar profile icon → "My Profile"). Both surfaces share the same `PROFILE_QUESTIONS` data model and live in the same code path.

Goal: replace the current shadcn-style profile UI (`#profileWizardOverlay` + `#prefsModal` in `public/planner.html`) with the **GuideMe** design language already in use across the rest of the redesigned app — Geist + Geist Mono + Instrument Serif italic accents, ivory `--paper-0` page on a navy `--ink-900` chrome, electric ocean `--accent` `#2F7DFB`, mono uppercase eyebrow labels for metadata, pill buttons, and quietly-shadowed cards.

**No app logic changes.** The wizard's step structure (`PROFILE_QUESTIONS.length + 2`), the question keys, the `state.profile` shape, the `data-rating` / dot-click event flow, and every render-function signature stay byte-identical to the current code.

---

## About the design files

The two HTML files in `mocks/` are **design references built in plain HTML/CSS/JS**, not production code. They are hand-built static prototypes whose purpose is to specify the intended look, layout, typography, spacing, and interaction surface.

The task is to **recreate these designs inside the existing GuideMe codebase** — a vanilla-JS SPA rendered by `public/app.js` against the markup in `public/planner.html`, styled by `public/styles.css`. Do not copy the HTML files verbatim. Instead, update the existing CSS and (only where strictly necessary) the existing markup so the live app matches the mocks.

If you're working in a fresh codebase rather than the original repo, you can use the mocks as the source of truth for the component itself; just match the structure that's already implied by `public/js/profileWizard.js` (the `PROFILE_QUESTIONS` array + `defaultProfile()` shape).

**Codebase:** `rrichardtang/GuideMe` (main).

---

## Fidelity

**High-fidelity.** Colors, typography, spacing, radii, shadows, and interaction states are final. Reproduce pixel-faithfully.

---

## What's in this bundle

```
design_handoff_profile/
├── README.md                  ← this file
└── mocks/
    ├── ProfileWizard.html     ← multi-step onboarding wizard (mock of #profileWizardOverlay)
    ├── Profile.html           ← traveler profile modal (mock of #prefsModal)
    └── styles/
        └── tokens.css         ← shared design tokens used by both mocks
```

Open either mock in a browser — they work standalone. Both reuse the same `tokens.css` shared with the rest of the redesign.

---

## Screens / Views

### 1) ProfileWizard.html — multi-step onboarding

**Purpose.** Captures the user's travel preferences on first launch (forced, no cancel) or whenever they create a new profile from the prefs modal (cancellable). On finish, persists a new profile via `saveProfiles({ activeId, profiles: [...] })` and dispatches `/api/profile/enrich` exactly as today.

**Step structure (matches `openProfileWizard` in `public/app.js`).**

- **Total steps** = `PROFILE_QUESTIONS.length + 2` = **16** (1 name + 14 questions + 1 about-me)
- **Step 01** — Profile name (text, `maxlength="32"`, default `"My Profile"`)
- **Steps 02–15** — Each entry in `PROFILE_QUESTIONS`, in order:

  | Step | key                        | type   | label                                                                |
  |------|----------------------------|--------|----------------------------------------------------------------------|
  | 02   | `museumPerson`             | scale  | Are you a museum person?                                             |
  | 03   | `foodTravel`               | scale  | Do you travel for food?                                              |
  | 04   | `livePerformances`         | scale  | Do you enjoy live performances?                                      |
  | 05   | `outdoorNature`            | scale  | Do you enjoy outdoor / nature activities?                            |
  | 06   | `nightlifeBars`            | scale  | Are you into nightlife and bars?                                     |
  | 07   | `structuredTours`          | scale  | Do you like guided tours?                                            |
  | 08   | `shoppingPerson`           | scale  | Do you enjoy shopping while traveling?                               |
  | 09   | `pace`                     | scale  | How packed do you like your days?                                    |
  | 10   | `dayStructure`             | text   | How do you like your days structured?                                |
  | 11   | `dietaryRestrictions`      | text   | Do you have any dietary restrictions or food preferences?            |
  | 12   | `mobilityConsiderations`   | text   | Any mobility or physical considerations we should know about?        |
  | 13   | `budgetStyle`              | text   | How would you describe your spending style while traveling?          |
  | 14   | `travelCompanions`         | text   | Who are you typically traveling with?                                |
  | 15   | `shoppingInterests`        | text   | What do you like to shop for while traveling?                        |

- **Step 16** — Anything else we might have missed? (`aboutMe`, textarea)

**Layout** (560px max-width, centred on a blurred `rgba(7,11,18,.62)` scrim).

```
┌─ wiz (radius --r-xl, --paper-1, border --hair, --sh-lg) ───────┐
│ HEADER  pad 20 24 0                                            │
│   "STEP 03 / 16"   eyebrow + accent dot      [×] close 30×30  │
│                                                                │
│ PROGRESS  pad 14 24 0                                          │
│   ▬▬▬▬▬▬▬▬▬▬▬▬▬░░░░░░░░░░░░░░░░░░░░  (2px hair, ink-900 fill) │
│   ▰ ▰ ▰ ▰ ▱ ▱ ▱ ▱ ▱ ▱ ▱ ▱ ▱ ▱ ▱ ▱  (16 pip-row beneath)       │
│                                                                │
│ BODY  pad 26 36 28, min-height 360                             │
│   eyebrow:  STEP 03   FOOD                                     │
│   title:    Do you travel for food?  (28px, Geist 500)         │
│   sub:      one-sentence helper, --text-500                    │
│                                                                │
│   ── content area ───────────────────────────────────────      │
│   (changes per step — see "Step body variants" below)          │
│   ────────────────────────────────────────────────────         │
│                                                                │
│   WHY WE ASK · paper-2 aside, 12.5px text-700                  │
│                                                                │
│ FOOTER  pad 16 24 22, border-top --hair, bg --paper-1          │
│   [← Back]      ⏎  to continue          [Next →] / [Finish ✓] │
└────────────────────────────────────────────────────────────────┘
```

**Step body variants.**

- **Name step (step 01):** Borderless 26px Geist 500 input with a hair-line underline that darkens to `--ink-900` on focus. Underneath: a mono character counter `0 / 32` plus a `Press Tab to advance` hint.
- **Scale step (dot scale, steps 02–09):**
  - Top row: live value label in 38px Instrument Serif italic (e.g. *Neutral*) on the left, mono `3 of 5` index on the right.
  - Below: 5 dots on a hairline rail. Dots to the left of the current value are filled `--ink-900`; the current dot is enlarged (22×22) with a 2px `--accent` ring + soft glow; remaining dots are `--paper-1` with `--hair-strong` border. The hairline fills with `--ink-900` from the left up to the current dot.
  - Mono end labels under the rail (e.g. `CASUAL EATS` / `FINE DINING`).
- **Text step (steps 10–15) and About-me (step 16):** Single multiline textarea, `--paper-0` well with `--hair` border that turns `--accent` on focus + 3px `rgba(47,125,251,.12)` ring. Use the production `placeholder` value for each key (see table above and `public/js/profileWizard.js`).

**Header controls.**

- **Step counter** — `STEP 03 / 16`. The `03` is zero-padded, `--text-900`, Geist Mono 10.5px, `letter-spacing: 0.14em`. The `/ 16` and the word `STEP` are `--text-500`. A 6px accent dot with a 3px `rgba(47,125,251,.16)` glow sits to the left.
- **Cancel** — a 30×30 circular ghost button, `--hair` border, `--text-500` icon. Hidden via `display:none` (production class `.hidden`) when the wizard is opened with `forced: true`.

**Progress row.**

- **Bar** — 2px tall, `--hair` track, `--ink-900` fill, radius 999. Width tweens 480ms `--ease-out`. Computed: `Math.max(6, Math.round(((stepIndex + 1) / TOTAL) * 100))`%.
- **Pip ladder** — 16 equal flex-1 pips below the bar, 6px high, `--paper-2` w/ `--hair` border. Done pips switch to `--ink-900` solid. The current pip uses `--accent` + a 3px `rgba(47,125,251,.14)` glow.

**Footer hint.** `⏎ to continue` (mono uppercase, `--text-400`), with a small `--paper-2` rounded kbd block around the `↵` glyph. On the last step (about-me), the hint reads `⏎ to finish` and the right button label becomes `Finish ✓`.

**Why-we-ask aside.** A `--paper-2` rounded box at the bottom of the body that explains why this question matters (e.g. *"Decides how many meal slots we flag for booking and how special they are."*). Mono `WHY WE ASK` key on the left, body copy on the right. Keep this terse — one sentence.

**Entry / exit motion.**

- Overlay scrim fades in over 280ms `var(--ease-out)`.
- Modal rises from `translateY(14px) scale(.985)` to `translateY(0) scale(1)` over 360ms `var(--ease-out)`.
- Between steps: eyebrow, title, sub, content, aside fade + translateY(-4px) out over 140ms, then in over 280ms. Drive this with a single class on the body (`.is-leaving`) toggled either side of the state mutation.

**Keyboard.**

- `Enter` advances (when focus is in an `<input>`, not a `<textarea>`).
- `Esc` cancels (unless `forced`).
- `←` / `→` step backwards / forwards (when focus is not in an input/textarea).
- Tab order: name input / scale dots / textarea → Back → Next.

---

### 2) Profile.html — Traveler Profile modal

**Purpose.** Standalone modal opened from the topbar `My Profile` menu item. Lets the user view and edit their saved answers. Triggered by `openPreferencesModal()` in `public/app.js`; the corresponding markup today is `#prefsModal` in `public/planner.html`.

**Layout** (680px max-width, scrollable inside a fixed scrim).

```
┌─ pf (radius --r-xl, --paper-1, border --hair, --sh-lg) ────────┐
│ HEADER  sticky, pad 22 28 18, border-bottom --hair             │
│   "PROFILE · TRAVELER PROFILE"   [save] [×]                    │
│   My Profile's Traveler Profile   (26px serif accent on name)  │
│                                                                │
│   profile switcher                                             │
│   [● My Profile]  [+ New profile]      1 / 3 mono              │
├────────────────────────────────────────────────────────────────┤
│ BODY  pad 6 28 18                                              │
│                                                                │
│   ── Section A · Travel style ───────  Tap a dot to set        │
│   Are you a museum person?            ○ ○ ○ ○ ○    NEUTRAL    │
│   Do you travel for food?             ○ ○ ○ ○ ○    NEUTRAL    │
│   …                                                           │
│   How packed do you like your days?   ○ ○ ○ ○ ○    MODERATE   │
│                                                                │
│   ── Section B · Specifics ──────────  Free text · optional   │
│   How do you like your days structured?                        │
│     [ textarea, placeholder italic ]                           │
│   Do you have any dietary restrictions?                        │
│     [ textarea ]                                              │
│   …                                                           │
│                                                                │
│   ── Section C · Anything else we might have missed? ──        │
│   Any other preferences, quirks, or context...                 │
│   [ tall textarea ]                                           │
│                                                                │
│   ── Section D · AI surfaces (hidden until populated) ───      │
│   ∴ AI SUMMARY · Will appear after you save this profile.      │
│   ∴ LEARNED BY AI · Builds up as the planner picks things up.  │
├────────────────────────────────────────────────────────────────┤
│ FOOTER  pad 18 28 22, border-top --hair, bg --paper-2          │
│   ● Autosaved · last edit just now    [🗑 Delete] [💾 Save]   │
└────────────────────────────────────────────────────────────────┘
```

**Section A — Travel style.** Renders only the 8 scale questions from `PROFILE_QUESTIONS` (i.e. those without `type: 'text'`). Each row is a 2-column grid: `1fr 320px`. The 320px right column is fixed so the dots line up vertically across rows regardless of label length. Within that column: dots are flush right (`order: 2`), the mono value label is to their left (`order: 1`, `flex: 1`, `text-align: right`, `text-overflow: ellipsis`). Rows separated by `1px dashed --hair`.

- **Dot** — 12×12 round, `--paper-3` bg, 1px `--hair-strong` border.
- **Done dot** (left of current) — `--ink-900` fill + border.
- **Current dot** — `--accent` fill, 3px `rgba(47,125,251,.16)` ring.
- **Hover** — `transform: scale(1.1)`, border → `--text-900`.
- **Value label** — Geist Mono 10.5px / `0.12em` / uppercase, tabular-nums. Color `--text-700`; when the value is still the default (3), use `--text-400` so unset answers visibly recede.

**Section B — Specifics.** Renders only the 6 text questions. Each row: question label (Geist 500 13.5px), then a textarea well (`--paper-0` bg, `--hair` border, focus → `--accent` border + ring). Placeholder text is italicized in `--text-400`. Use the production `placeholder` strings.

**Section C — Anything else we might have missed?** A single tall textarea bound to `state.profile.aboutMe`. Uses the exact production placeholder: `"e.g. I'm not a morning person, I have a smaller budget, avoid things with lots of walking..."`.

**Section D — AI surfaces.** In production, `#aiSummarySection` and `#learnedPrefsSection` toggle `.hidden` based on whether the AI has produced content. While they're empty, render a dashed `--hair-strong` note saying so — a mono `∴ AI SUMMARY` key + a body sentence. Drop these notes entirely once data exists and reveal the production textarea / chip list.

**Profile switcher.**

- Up to 3 profiles (`normalizeProfilesStore` caps at 3 in `public/js/profileWizard.js`).
- Active profile is a filled pill: `--ink-900` bg, `--paper-0` text, with a 6px `--accent` dot + glow on its left.
- Inactive profiles are paper-2 ghost pills with a hairline border.
- A dashed `+ New profile` chip on the end opens the wizard (`openProfileWizard(store, { forced: false })`).
- Mono `1 / 3` meta sits to the right of the switcher.

**Header.**

- Eyebrow: `PROFILE` accent-soft pill + ` Traveler Profile` plain mono.
- Title: `<name>'s Traveler Profile` — the name itself is set in Instrument Serif italic.
- Two icon buttons on the right: floppy `#profileEditBtn` (grey) and close `#prefsClose` (red on hover). Both 30×30, circular, hair border. Use Phosphor Bold icons (`ph-floppy-disk`, `ph-x`) at 12px.

**Footer.**

- Left status: 6px ok-green dot with glow + mono `Autosaved · last edit just now`. This replaces nothing — it's a new affordance that surfaces what's otherwise invisible (the modal already persists on every edit).
- Right: Delete profile (`.danger` ghost pill, `--err` on hover) maps 1:1 to the existing `#deleteProfileBtn` handler. Primary Save (`--ink-900` pill).

---

## Interactions & Behavior

### Wizard

| Surface | Handler in app.js | Behavior |
|---|---|---|
| Cancel (`#wizardCancelBtn`) | inline `onclick` in `openProfileWizard` | Calls `closeWizard()`. Hidden when `forced: true`. |
| Back (`#wizardBackBtn`) | inline `onclick` | `wizardState.stepIndex--`, then `render()`. Hidden on step 0. |
| Next / Finish (`#wizardNextBtn`) | inline `onclick` | Calls `currentStepAnswer()` to commit input, then increments `stepIndex` or `finishWizard()`. |
| Dot click | `[data-rating]` delegation | Updates `wizardState.answers[q.key]`, toggles `.active`, refreshes the live label via `q.key === 'pace' ? pacePrefLabel(v) : profileLabel(v)`. |
| `Escape` | `onWizardKey` | Same as Cancel (unless `forced`). |

### Profile modal

| Surface | Handler | Behavior |
|---|---|---|
| Dot click | `els.profileQuestions.querySelectorAll('[data-rating]')` | Updates `state.profile.answers[key]`, re-applies `.active`, refreshes the label. |
| Textarea input | `.profile-text-answer` input listener | Mirrors value into `state.profile.answers[key]`. |
| Save (`#profileEditBtn`) | existing | POSTs `getProfilePayload()` to `/api/profile/enrich`. |
| Delete (`#deleteProfileBtn`) | `deleteActiveProfile()` | Shows confirm, clears `state.profilesStore`, reopens wizard with `forced: true`. |
| Close (`#prefsClose`) | `closePreferencesModal()` | Unchanged. |
| Profile switcher | new | Use existing `state.profilesStore.activeId` mutation. Switching reloads the modal via `renderPreferencesModal()`. |

### Motion

| Element | From | To | Duration / easing |
|---|---|---|---|
| Wizard overlay scrim | `opacity: 0` | `opacity: 1` | 280ms `--ease-out` |
| Wizard card | `translateY(14px) scale(.985)`, `opacity: 0` | `translateY(0) scale(1)`, `opacity: 1` | 360ms `--ease-out` |
| Profile modal | same as wizard card | same | 360ms `--ease-out` |
| Step cross-fade | leaving content `translateY(0) → -4px`, `opacity 1 → 0` | mirror in | 140ms out / 280ms in `--ease-out` |
| Progress bar width | previous width | new width | 480ms `--ease-out` |
| Dot scale fill | previous width | new width | 320ms `--ease-out` |
| Pip / dot color | previous | next | `--dur-fast` (140ms) `--ease-out` |

### States

- **Default value** for every scale question is `3` (`PROFILE_DEFAULT`). In the Profile modal, when a scale row is still at 3 the right-hand label uses `--text-400` (not the regular `--text-700`) so the user can tell what hasn't been answered yet.
- **Empty text answer** — placeholder italicized in `--text-400`.
- **Active scale dot** — accent fill + ring (current); ink fill (any dot to the left of current).
- **Wizard finish state** — Next button changes label to `Finish` and icon to `ph-check`; the kbd hint changes to `to finish`.

### Responsive

- **≥ 641px** — layouts as drawn (560px wizard, 680px profile modal).
- **≤ 640px** — modal becomes full-width minus 16px gutter, radius drops to `--r-lg`, scale rows in Profile collapse to single-column with the label below the question, faux page chrome (`.stage__page`) hidden.

---

## State management

### Wizard

```js
const wizardState = {
  stepIndex: 0,
  name: 'My Profile',
  answers: Object.fromEntries(
    PROFILE_QUESTIONS.map(q => [q.key, q.type === 'text' ? '' : PROFILE_DEFAULT])
  ),
  aboutMe: ''
};
```

On finish:

```js
const profile = {
  id: createProfileId(),
  name: normalizeProfileName(wizardState.name, 'My Profile'),
  answers: { ...wizardState.answers },
  aboutMe: wizardState.aboutMe || ''
};
state.profilesStore = saveProfiles({
  activeId: profile.id,
  profiles: [...store.profiles, profile]
});
state.profile = normalizeProfile(profile);
```

### Profile modal

State lives in `state.profile` (a `normalizeProfile`-shaped object) plus `state.profilesStore` (the multi-profile container). Every dot click and text input writes back to `state.profile` immediately. Save persists to `/api/profile/enrich`.

**Do not change** the shape or field names. The current renderer reads `state.profilesStore.profiles[i].answers[q.key]` and `state.profilesStore.profiles[i].aboutMe`; the new CSS reads no data.

---

## Design tokens

All tokens live in `mocks/styles/tokens.css`. The mocks expect these to be available globally; if they aren't yet in `public/styles.css`, drop the file in next to it and load it first.

### Surfaces

| Token | Value | Use |
|---|---|---|
| `--ink-abyss` | `#070B12` | Modal scrim base (combined with 0.62 opacity). |
| `--ink-900` | `#0A1628` | Primary dark — header chrome, primary button bg, filled dots. |
| `--ink-800` | `#112240` | Primary button hover. |
| `--ink-700` | `#1B2A47` | Topbar bottom border. |
| `--paper-0` | `#F4F1EC` | Page background; textarea well bg. |
| `--paper-1` | `#FAF8F4` | Wizard / modal card surface. |
| `--paper-2` | `#EEEAE3` | Aside boxes; profile chip ghost bg; footer bg; pip track. |
| `--paper-3` | `#E2DED6` | Inactive scale dot fill. |

### Text

| Token | Value | Use |
|---|---|---|
| `--text-900` | `#0A1628` | Question labels, headings, name in title. |
| `--text-700` | `#1E293B` | Body, active mono label. |
| `--text-500` | `#5A6679` | Eyebrows, sub-copy. |
| `--text-400` | `#8490A3` | Placeholder, default-value mono label, footer hint. |

### Hairlines

| Token | Value |
|---|---|
| `--hair` | `rgba(10,22,40,.08)` |
| `--hair-strong` | `rgba(10,22,40,.14)` |

### Accent + status

| Token | Value | Use |
|---|---|---|
| `--accent` | `#2F7DFB` | Current dot, focus ring, primary live pulse. |
| `--accent-deep` | `#0B4AB8` | Accent text on light bg (eyebrow key chip). |
| `--accent-soft` | `#E6EFFE` | Eyebrow key chip bg, focus-ring hover trim. |
| `--ok` | `#1F9D55` | Autosave dot, finish-state pulse. |
| `--err` | `#C0362C` | Delete CTA. |

### Type

```html
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&family=Instrument+Serif&display=swap" rel="stylesheet">
```

| Token | Value |
|---|---|
| `--font-display` | `'Instrument Serif', 'Cormorant Garamond', Georgia, serif` |
| `--font-sans` | `'Geist', 'Inter', 'Söhne', system-ui, sans-serif` |
| `--font-mono` | `'Geist Mono', 'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace` |

Type rules:
- Headings: Geist 500, `letter-spacing: -0.025em`, line-height 1.10–1.15. Accent word set in `<span class="serif">` (Instrument Serif italic, weight 400).
- Eyebrow labels: Geist Mono 10.5px, `letter-spacing: 0.14em`, uppercase, color `--text-500`.
- Body: Geist 400/500 at 13.5–14px, `letter-spacing: -0.005em`.
- Numbers: Geist Mono with `font-variant-numeric: tabular-nums`. Counters use zero-padded two-digit form (`01`, `03`, `16`).

### Radii

| Token | Value | Use |
|---|---|---|
| `--r-sm` | `6px` | (unused here, available for kbd chips) |
| `--r-md` | `10px` | Textarea well, aside box |
| `--r-lg` | `16px` | Mobile breakpoint cards |
| `--r-xl` | `24px` | Wizard + Profile card |
| `--r-pill` | `999px` | All buttons and chips |

### Shadows

| Token | Value |
|---|---|
| `--sh-sm` | `0 1px 2px rgba(10,22,40,.04), 0 1px 1px rgba(10,22,40,.03)` |
| `--sh-md` | `0 4px 18px rgba(10,22,40,.06), 0 2px 6px rgba(10,22,40,.04)` |
| `--sh-lg` | `0 24px 60px rgba(10,22,40,.12), 0 8px 20px rgba(10,22,40,.06)` |

### Motion

| Token | Value |
|---|---|
| `--ease-out` | `cubic-bezier(.2, .8, .2, 1)` |
| `--ease-inout` | `cubic-bezier(.65, 0, .35, 1)` |
| `--dur-fast` | `140ms` |
| `--dur-med` | `280ms` |
| `--dur-slow` | `520ms` |

---

## Assets

Both mocks use:
- **Phosphor Icons (Bold weight)** — already loaded by the GuideMe app at `https://unpkg.com/@phosphor-icons/web@2.1.1/src/bold/style.css`. Icons used: `ph-x`, `ph-arrow-left`, `ph-arrow-right`, `ph-check`, `ph-user-circle`, `ph-check-square`, `ph-floppy-disk`, `ph-trash`, `ph-plus`.
- **Google Fonts** — Geist, Geist Mono, Instrument Serif (see `<link>` above).

No raster images. No custom SVGs.

---

## Files to update in the real repo

| Live file | What changes |
|---|---|
| `public/styles.css` | Replace the `/* ── Profile Creation Wizard ── */` block (currently around line 1863) with the new wizard styling. Replace the `.profile-questions` / `.profile-question` / `.dot-scale-*` blocks (currently around lines 1202–1245) with the new Profile modal styling. Drop `--accent` etc. into `:root` if not already there. |
| `public/planner.html` | `#profileWizardOverlay` markup: add the eyebrow pill / pip-row scaffold around the existing progress bar; replace the H3 header pattern with the new step counter chip. `#prefsModal` markup: split the existing `#profileQuestions` rendering target into two sibling containers (`#pfScaleQs` for scale questions, `#pfTextQs` for text questions) so they can sit under named sections — or wrap the existing render output with a `data-q-type` attribute and section it via CSS only. |
| `public/app.js` | **No logic changes.** Only update `bodyHtml` template strings inside `openProfileWizard.render()` (lines ~2985–3015) and `renderPreferencesModal()` (lines ~2802–2860) to emit the new class names — eyebrow, title with `<span class="serif">`, aside, etc. Keep every `id`, every `data-rating`, every `data-question`, every `q.key` derived className. |

---

## Files in this bundle

- `mocks/ProfileWizard.html` — open in a browser, click `Next` to step through every state (name → 14 questions → about-me → finish).
- `mocks/Profile.html` — open in a browser, click any dot to see the live label update. Section D (AI surfaces) is shown in its empty state.
- `mocks/styles/tokens.css` — the design tokens both mocks read from.

---

## Verification

Open `mocks/Profile.html` in one tab and the live app's Traveler Profile modal in another at 1280px viewport. Walk through both. They should be visually identical aside from any user-entered data. For the wizard, do the same with `mocks/ProfileWizard.html`, stepping through with Next.
