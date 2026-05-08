# Current State

_Last updated: 2026-05-08_

## Objective
Two trip-feedback gaps from a recent Spain trip are addressed on `feature/insider-tips-shopping`: (1) every recommended activity now ships with an optional `insider_tips` field grounded in fresh Brave search; (2) shopping is a real interest vertical with profile slider + freeform, dedicated activity type, and conditional Brave shopping-research grounding.

## Active Workstream
Pending user smoke test:
- Plan a Granada/Madrid trip with shopping interest set to 5 and `shoppingInterests = "fragrance, fashion"`. Confirm 1-3 shopping activities appear with specific stores (Druni, Primor, Zara, Salamanca district) each carrying actionable insider_tips (tax-free refund, US-vs-EU pricing).
- Confirm sunset/viewpoint activities (e.g. San Nicolás Mirador) ship with insider_tips covering peak crowding window and best arrival time.
- Verify `insider_tips: null` activities render cleanly (no empty 💡 row).

## Constraints
- No database — flat JSON files.
- Brave free-tier quota (2000/month) — added 1 always-on call (`searchInsiderTips`) and 1 conditional call (`searchShoppingDistricts` only when `shoppingPerson >= 3`) per planned city.
- 90/90 tests still green; no test changes required since fields are additive.

## Risks
- LLM may still produce generic "arrive early" insider_tips despite the "return null when you have nothing factual" rule. If smoke test surfaces this, tighten the system prompt rule with explicit negative examples.
- Existing user profiles will default `shoppingPerson` to 3 (PROFILE_DEFAULT) on next normalize — that's >= 3, so they'll start getting shopping recs without re-running the wizard. Acceptable since the floor is small (1 activity for a short trip) and shopping interests text will be empty (so the Brave query falls back to generic "shopping districts").

## Next Actions
- User smoke test of insider tips + shopping flow.
- On approval, push branch and decide whether to backfill insider_tips on existing saved itineraries via `/api/activity/refine` or leave them empty until next plan.
