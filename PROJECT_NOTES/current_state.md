# Current State

_Last updated: 2026-04-21 (session 19)_

## Objective
Phase 3 (Finalize Modal + time locks) implemented on `feature/arrange-time-locks`. Ready for VPS deploy + smoke test.

## Active Workstream
`feature/arrange-time-locks` — all Phase 3 features complete, tests green. Pending push and deploy.

## Constraints
- No database — flat JSON files
- Migration is in-memory only on load; write-back happens on next user save
- New itineraries tagged `_schemaVersion: 2` after save
- Buffer tables duplicated in `src/` (server/test) and `public/js/` (client) — must stay in sync
- `state.lastFinalizeLocks` is in-memory only (not persisted to localStorage/server) — clears on page reload

## Risks
- `state.lastFinalizeLocks` is ephemeral — lock icons and drag protection disappear on reload. Acceptable per spec (modal is a per-run picker, not persistent lock management)
- `openFinalizeModal` inline time picker sets `entry.date` from the initially computed placement day; if no placement exists yet, falls back to first city day — should be fine for most cases
- `/refine` still depends on `OPENAI_API_KEY`

## Next Actions
- Push `feature/arrange-time-locks` to remote: `git push -u origin feature/arrange-time-locks`
- Deploy to VPS and run Phase 3 exit criteria from `arrange_phase3_locks.md` §7
- Smoke test: verify Draft clears lock icons, Finalize pins activity at chosen time
