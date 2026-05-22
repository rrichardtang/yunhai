# Current State

_Last updated: 2026-05-21_

## Objective
Concierge bot revamp: grounded website knowledge with no-guess directive, step-aware suggestion chips, and a high-fidelity dark-theme redesign per `design_handoff_concierge/`.

## Active Workstream
Branch `feature/concierge-bot-knowledge` — knowledge base + step-aware chips shipped earlier this session; redesigned chat widget UI shipped just now. 99/99 tests pass. Awaiting browser smoke test + push of the redesign commit.

## Constraints
- Bot answers help questions strictly from `src/services/websiteGuide.md`; closest-match + confirm when feature doesn't exist.
- Website guide injected only when `looksLikeHelpQuestion(message)` returns true.
- Chat redesign uses tokens from `design_handoff_concierge/tokens.css` (ink-900 shell, paper-0 text, electric-blue accent). Geist / Instrument Serif / Geist Mono fonts already loaded in `planner.html`.
- `prefers-reduced-motion` disables halo, glint, avatar pulse, and replaces morph with a 120ms fade.
- Suggestion chips hide once the chat session has any user message; chip text remains step-aware (4 sets of 3).

## Risks
- Heuristic `looksLikeHelpQuestion` may false-trigger on travel questions that contain "where is" — Brave search bypass would hurt that reply. Watch for this.
- (Carried over) Google OAuth client secret was briefly exposed; should be rotated.
- (Carried over) `client_secret_*.json` should be added to `.gitignore`.

## Next Actions
- Browser smoke test: open chat, verify FAB animations + morph, click each step's chips, send a help question (verify typing dots → reply with role label), test Escape-to-close, test reduced-motion mode in DevTools.
- Push `feature/concierge-bot-knowledge` and verify on staging.
- Rotate Google OAuth secret + .gitignore the client_secret file (deferred from prior session).
