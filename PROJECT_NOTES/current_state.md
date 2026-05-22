# Current State

_Last updated: 2026-05-22_

## Objective
Ship the new YunHai landing page with a live-product demo reel embedded as an iframe of the real `planner.html`.

## Active Workstream
Branch `feature/yunhai-landing`. Landing page, embed mode, and demo reel engine all built. 99/99 tests pass. Awaiting browser smoke test + manual verification of the scripted Setup beat against the real Cities UI.

## Constraints
- Brand on the new landing is **YunHai** (not GuideMe, not TravelPlanner). Internal app header in `planner.html` also renamed to YunHai for consistency inside the demo iframe.
- Demo iframe loads `/planner.html?embed=1`. `?embed=1` bypasses Clerk, hides chrome, seeds a Córdoba city, and unlocks `state.maxStep = 4` so `setStep(2..4)` works.
- Landing CSS is namespaced under `public/styles/landing/` so it never collides with the planner's own CSS.
- Demo reel targets the *real* Cities-step selectors (`#addCityBtn`, `.city-row:last-child [data-field=…]`, `[data-logistics=…]`, `[data-tab=…]`, `[data-accommodation-field=…]`) — no `data-demo-anchor` injection.
- Transport-mode select in the real app has no Bus option; departure beat uses `other` with narrator copy that says "ground transit."

## Risks
- Clerk SDK script tags 404 in embed mode when `CLERK_PUBLISHABLE_KEY` env is unset (URL becomes `https:///…`). Noisy in console, harmless functionally because we never touch `window.Clerk` in embed mode.
- The iframe re-renders the cities container on tab switch (real-app behavior). Selectors are based on `.city-row:last-child` so they survive, but visual cursor jitter is possible between tab clicks.
- (Carried over) Google OAuth client secret was briefly exposed; should be rotated.
- (Carried over) `client_secret_*.json` should be added to `.gitignore`.

## Next Actions
- Browser smoke test at `http://localhost:3457/`: verify hero stage animates, marquee renders, demo reel boots, iframe loads without Clerk gate, Setup beat completes through all 7 narrator substeps, dots advance to Review/Arrange/Finalize.
- Push `feature/yunhai-landing` and verify on staging.
- Rotate Google OAuth secret + `.gitignore` the `client_secret` file (deferred from prior sessions).
