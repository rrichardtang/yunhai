# Current State

_Last updated: 2026-04-16 (session 10)_

## Objective
Restaurant specificity: planner now names specific venues with must-order dishes for all meal activities.

## Active Workstream
Added targeted restaurant search to planning pipeline:
- `searchTopRestaurants()` in `braveSearch.js` fires a focused Brave query per city
- Results injected as a dedicated prompt block instructing geographic venue selection
- System prompt now has a MANDATORY RULE: all food/breakfast/lunch/dinner activities must name a specific restaurant and mention 1–2 must-order dishes in `why_it_fits`

## Constraints
- No database — flat JSON files, consistent with existing architecture
- localStorage kept as local cache for offline/low-latency access
- All iOS browsers forced onto WebKit engine — Brave on iPhone behaves like Safari
- `planner.html` still does not load helper scripts directly; `app.js` retains runtime fallbacks

## Risks
- `/refine` model is `gpt-5.4-mini` — unknown if this model ID is stable/correct (was used for chat concierge already; low risk)
- Budget optimization batch UI (flip cards, progress bar) not yet wired — `/refine` is ready to serve it as backbone
- Restaurant Brave results may not always include local neighborhood context — model falls back to general knowledge if block is empty

## Next Actions
- Smoke test a city plan and verify meal activities name specific restaurants with dishes
- If Brave results are thin, consider adding a second query variant (e.g. "top rated local restaurants {city} neighborhood")
