# Current State

_Last updated: 2026-04-24_

## Objective
Fix Phase 1 runtime errors found during testing: `_exports` redeclaration in shared scripts and `activityMapOverlay` temporal dead zone crash. Both fixed on the current feature branch.

## Active Workstream
Phase 1 smoke-testing. Two bugs fixed:
1. `shared/arrangeBuffers.js` and `shared/arrangeArrivalBuffers.js` — both declared `const _exports` at top-level global script scope; collision when both `<script>` tags loaded. Wrapped each in an IIFE.
2. `public/app.js` — `overlayManager.register('activityMapOverlay', ...)` was called at line 8 before `let activityMapOverlay` was declared at line 248 (temporal dead zone). Moved register call to immediately after the declaration.

## Constraints
- No database — flat JSON files
- All `/api/*` route paths must remain stable through the cleanup
- Server now exports app; `listen` guarded by `require.main === module`
- Client-side shared modules live in `/shared/` and are served via `app.use('/shared', express.static(...))`

## Risks
- Profile icon missing — likely collateral damage from the `_exports` crash halting app.js execution; should resolve with the fixes. If still missing after deploy, needs separate investigation.
- Phase 2 will reorder middleware around the auth gate — smoke harness is the primary regression net

## Next Actions
- Deploy and verify: confirm no console errors, profile icon visible, all 11 overlays functional
- If profile icon still missing after fixes, trace separately
- On smoke pass, begin Phase 2 (backend modularization)
