# Current State

_Last updated: 2026-05-21_

## Objective
Give the Concierge Bot grounded knowledge of how the website works so it can answer user "how do I…" questions without hallucinating, and nudge users with 3 step-aware suggested questions when the chat is empty.

## Active Workstream
Branch `feature/concierge-bot-knowledge` — implementation complete locally, 99/99 tests pass. Awaiting smoke test in browser + push.

## Constraints
- Bot answers help questions strictly from `src/services/websiteGuide.md`. Never fabricates UI; proposes closest real feature when the user uses wrong terminology.
- Website guide injected only when `looksLikeHelpQuestion(message)` returns true (saves tokens, preserves Brave quota).
- Suggestion chips hide once the chat session has any user message.
- No backend changes for chips (frontend uses existing `step` field in `tripContext`).

## Risks
- Heuristic `looksLikeHelpQuestion` may false-trigger on travel questions that contain "where is" (e.g. "where is the best ramen"). The Brave search bypass would then hurt that one reply. Watch for this in smoke testing.
- (Carried over) Google OAuth client secret was briefly exposed; should be rotated.
- (Carried over) `client_secret_*.json` should be added to `.gitignore`.

## Next Actions
- Browser smoke test: ask each step's chips, then "How do I pin an activity?" (should propose Lock), and a non-help travel question (should still get Brave search).
- Push `feature/concierge-bot-knowledge` and verify on staging.
- Rotate Google OAuth secret + .gitignore the client_secret file (deferred from prior session).
