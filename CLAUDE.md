# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Session Startup

At the start of every session, before any task work, load project context:

1. Check that `PROJECT_NOTES/` exists with all four files. If any are missing, create them from the scaffold templates in the **Project Notes Maintenance** section below.
2. Always read `PROJECT_NOTES/current_state.md` and `PROJECT_NOTES/open_items.md`.
3. Read `PROJECT_NOTES/decisions.md` only if the request touches architecture, tooling, or past tradeoffs.
4. Skim `PROJECT_NOTES/changelog.md` only if the user asks "what changed" or context is unclear.
5. Invoke the `ponytail` skill and keep it active for the session. It governs what gets built —
   YAGNI, stdlib and existing helpers before new code, shortest working diff — and stays on until
   the user says "stop ponytail" or "normal mode". It arrives from the claude.ai account (cloud
   sessions) or the `claude-config` sync (local), not from this repo.
6. Output a bootstrap summary (2–3 sentences: active objective, critical open items, immediate next actions), then proceed.

Do not ask the user whether to read the notes, or whether to load ponytail — just do it.

## Commands

```bash
npm start          # Run the server (node src/server.js, port 3457)
npm test           # Run all tests (node --test "src/**/*.test.js")
```

To run a single test file:
```bash
node --test src/tripHealth.test.js
```

Local setup:
```bash
cp .env.example .env   # Fill in API keys
npm install
npm start              # Visit http://localhost:3457
```

## Architecture

TravelPlannerAgent is a full-stack AI travel itinerary builder: an Express.js backend with a vanilla JS frontend, Clerk authentication, flat-file JSON persistence, and multi-LLM AI integration.

### Request Flow

1. **Auth**: Clerk JS blocks the frontend UI until a session is active. All backend routes use `clerkMiddleware()` + `requireAuth()`; user data is scoped by `req.auth.userId`.
2. **Planning**: The frontend's 5-step workflow (Cities → Activities → Arrange → Review → Trip Health) calls `/api/plan` (SSE stream), `/api/arrange`, `/api/activity/refine`, and `/api/activity/replace`.
3. **AI calls**: A global semaphore caps LLM calls at 10 concurrent across all users, regardless of provider. Cities are planned 3 in parallel. GPT-5.6 handles activity planning; GPT-5.4-mini handles chat concierge and activity refinement; Claude Sonnet 4.6 handles auto-arrange; Haiku handles fast profile summaries and memory reconciliation.
4. **State**: Client stores state in localStorage, synced to server on sign-in (last-write-wins). Server persists to flat JSON files under `/data/`.

### Key Backend Modules (`src/`)

- **`server.js`** — Express app bootstrap: Clerk middleware, static serving, route registration. Routes live in `src/routes/*.js`; shared middleware in `src/middleware/` (auth incl. `requireOwner`, LLM semaphore, upload). Everything under `/api` requires Clerk auth + entitlement except the public `/api/status`; `/debug` and `/api/admin/*` additionally require `OWNER_USER_ID`.
- **`services/llmJson.js`** — Shared LLM-output JSON toolkit (`extractText`, `tryParseJsonObject/Array`, fence stripping, truncation repair) used by `claude.js`, the activity routes, chat, and memory reconciliation.
- **`claude.js`** — `planCity()`: generates activities for one city using **GPT-5.6** with `SYSTEM_PROMPT_GPT_LEAN` (the file keeps its name from when it ran Claude). The model and the prompt travel together — `SYSTEM_PROMPT` is Claude-shaped and is not a drop-in. `openaiGenerator()` is the single provider-specific step: everything before it is prompt assembly and everything after is parsing and grounding, so `planCity`'s `generate` option swaps providers without touching the pipeline, which is how the bake-off ran Sonnet arms through this exact code path. Two other prompts are retained as bake-off arms only (`SYSTEM_PROMPT`, `SYSTEM_PROMPT_GPT`). JSON output parsing with retry logic.
- **`tripHealth.js`** — `computeTripHealth()`: validates trip consistency — detects overlapping dates/activities, missing times, missing bookings. Returns status (`Ready` / `Conflicts found` / `Needs booking`) + issue list + budget summary. Reads stored booking checklist from `itinerary.bookingChecklist`.
- **`preferences.js`** — Backward-compatible facade over the memory layer. Still exposes the three-tier view (`profileInstruction` (AI summary, file-backed at `/data/users/{userId}.json`), `preferences` (max 30), `constraints` (max 20)) for the preferences UI and `getSummary()`, but preferences/constraints now live in the memory store. `save()` does a diff-based sync so editor saves don't clobber learned-record metadata; legacy arrays migrate into the store on first access.
- **`memory/`** — Modular agent-memory layer (A-MEM / Mem0-inspired); the shared seam all four LLM touchpoints use. `index.js` exposes `recall()` (synchronous, no LLM, relevance-ranked retrieval merging user-scoped + per-trip memory; returns a prompt-ready `.text`) and `observe()` (detached/fire-and-forget ingestion with LLM-driven ADD/UPDATE/DELETE reconciliation). `store.js` is the swappable `MemoryStore` (flat-JSON at `/data/memory/{userId}.json` — the one file to re-implement for a DB). `reconcile.js` is the Haiku reconciliation call, gated by the global LLM semaphore. Records carry `{type, scope, tripId, keywords, salience, source, ts}`. Read sites: activity generation, arrange, chat, activity/refine, activity/replace. Write sites: chat signals, activity-decline, arrange feedback.
- **`itineraryStore.js`** — All itineraries in a single `/data/itineraries.json` keyed by userId. Max 50 per user. Atomic writes via temp-file pattern.
- **`chat.js`** — In-memory chat sessions keyed by itinerary ID. History compacted when tokens exceed 8000. Sessions are lost on server restart.
- **`arrangeConfig.js`** — CATEGORY_HINTS regex patterns infer activity type from name/description (e.g. "breakfast" → 07:30–10:30 opening window) for auto-arrange scheduling.
- **`braveSearch.js` / `braveRetrieval.js`** — Brave web search with task-based routing: `planning`, `chat_concierge`, `entity_enrichment`. Non-live queries (rewrites, summarization) are filtered out to preserve the 2000/month free quota.
- **`calendarSync.js`** — Google Calendar OAuth 2.0 (tokens at `/data/google-tokens/{userId}.json`). One-way export only. Activity fingerprinting avoids duplicate events on re-sync.
- **`emailForwarding.js`** — Deterministic per-user forwarding address (hashed userId). Webhook ingest parses email subject/body for flight/hotel/car confirmations via regex heuristics.

### Frontend (`public/`)

- **`app.js`** — Intentionally monolithic, and large enough that you should read the region you're changing rather than the whole file. Vanilla JS, no framework. Do not extract modules from it beyond clear boundary concerns. All `innerHTML` interpolation must go through the `esc()` helper; values read back from `dataset.*` come back entity-decoded, so re-escape them at read time.
- **`js/overlayManager.js`** — Modal/overlay lifecycle.
- **`js/statePersistence.js`** — localStorage helpers.

### Data Storage

All persistence is flat JSON files — no database:
- `/data/itineraries.json` — all itineraries
- `/data/users/{userId}.json` — preferences, constraints, profile instructions
- `/data/userdata.json` — cross-device sync data
- `/data/google-tokens/{userId}.json` — Google Calendar OAuth tokens
- `/data/email-routing.json` — email forwarding address map

### ID Conventions

- Itinerary: `it_{timestamp}_{random}`
- Checklist item: `chk_{timestamp}_{random}`
- API routes: `/api/{resource}/{id}/{action}`

## Key Architectural Decisions

- **Flat JSON only**: No database. Atomic writes with temp-file pattern. Sufficient to ~100 concurrent users; beyond that needs Redis + job queue.
- **Hybrid scheduling for auto-arrange**: `/api/arrange` splits judgment from arithmetic. Claude (via the `assign_days` tool in `src/services/arrangePromptDirect.js` → `buildAssignPrompt`) outputs ONLY a per-day activity assignment — which day each activity goes on, no times, no order. `src/services/arrangeScheduler.js` (`schedule()`) then deterministically does everything else: cross-day meal redistribution, per-day commute-minimizing ordering (brute-force for ≤7 non-meals, nearest-neighbor above), meal anchoring into lunch/dinner by opening hours, and concrete time assignment respecting opening hours, commute gaps, day windows, and locks. It returns `{placements:{id:{date,time}}, unplaced, diagnostics}`. Because the LLM never emits a time, time-arithmetic violations are structurally impossible — there is **no** LLM repair loop or force-drop stage. `src/arrangeValidator.js` `validate()` runs once at the end as a self-check that populates `diagnostics` (normally empty). Locked activities bypass the LLM and are treated as fixed obstacles. The deterministic core is unit-tested without an API key (`src/arrangeScheduler.test.js`).
- **Minimal frontend split**: Only boundary concerns (overlayManager, statePersistence) were extracted from `app.js`. Keep the rest in the monolith.
- **Per-trip chat sessions**: Chat context is keyed by itinerary ID so state doesn't bleed between trips.
- **AI summary regeneration**: Only regenerate `profileInstruction` on profile answer/aboutMe changes — not on manual edits to the summary textarea.
- **One-way integrations**: Calendar export is TravelPlanner → Google only; email forwarding is ingest-only. Intentional privacy-first design.
- **Cross-device sync**: On sign-in, server state is pulled and hydrates localStorage. Last-write-wins. No merge/conflict resolution.

## Required Environment Variables

See `.env.example` for the full list. Missing keys don't crash the app — features degrade gracefully with warnings surfaced in the UI. The `/api/status` endpoint returns current configuration health.

Key variables: `ANTHROPIC_API_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `OPENAI_API_KEY`, `BRAVE_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_MAPS_API_KEY`, `UNSPLASH_ACCESS_KEY`, `RESEND_API_KEY`.

## Testing

Uses Node.js built-in `node:test` — no Jest or external runner. Tests live alongside source as `*.test.js`, at the top of `src/` and in its subdirectories; `npm test` globs `src/**/*.test.js` recursively, so a bare `node --test src/*.test.js` silently skips the nested ones. Coverage focuses on: Brave routing logic, trip health/overlap detection, and city name validation. LLM integration is not mocked in tests.

## Engineering Practices

These rules are always active during any code generation, editing, or refactoring — they are
not opt-in and not something to defer. Reinforce them when output turns verbose, redundant, or
structurally complex.

One of them is mechanically enforced: `scripts/checkPractices.js` runs as a PostToolUse hook
(`.claude/settings.json`) and fails any Edit/Write that leaves a TODO/FIXME/XXX/HACK marker or
placeholder stub. The rest are judgement calls, so the enforcement is self-audit: before
presenting code, re-read it against this list and fix what violates rather than explaining it.

A second hook gates the way out: `scripts/prePushReview.js` runs as a PreToolUse hook on Bash and
blocks `git push` until the **`felix-the-fixer`** subagent (synced from `rrichardtang/claude-config`
via the `SessionStart` hook, not a project-local agent) has reviewed the exact commit being pushed.
Run it over the range the block names, act on what it finds, then
`node scripts/prePushReview.js --record`. The receipt is keyed on HEAD, so a new commit re-opens the
gate. Recording without a review is for pushes that carry no code (notes, docs) — say so when you do.
Record and push as two separate commands: the hook inspects the whole command string before any of
it runs, so `--record && git push` is blocked before the record half executes.

### Code Quality
- Simplify hard-to-read blocks; no overly complex logic
- No unnecessary comments — use descriptive names instead
- No defensive boilerplate (excessive null checks, try/catch wrappers) unless the context demands it
- Keep functions small and single-purpose
- Never re-derive a value that is already available
- No dead code, placeholder stubs, or TODO markers unless explicitly requested

### Output Efficiency
- Never repeat code that already exists — reference or import it instead
- When editing a file, output only the changed lines with enough surrounding context for an unambiguous match
- Prefer single focused edits over rewriting entire files

### Structure
- Prefer flat over nested — deep nesting is a signal to refactor
- Group related logic together; separate unrelated concerns into distinct functions or modules
- Keep module interfaces narrow — expose only what consumers need

If generated code violates any rule above, self-correct before presenting it. If a tradeoff is required, state it and recommend the cleaner option.

## Project Notes Maintenance

`PROJECT_NOTES/` contains four living files with strict ownership — content lives in exactly one file:

| File | Contains | Never contains | Update rule |
|---|---|---|---|
| `current_state.md` | Present-tense snapshot: objective, active workstream, constraints, risks | History, rationale, completed items | Overwrite entirely each pass |
| `decisions.md` | **Why** a choice was made: reasoning, tradeoffs, alternatives rejected | Implementation details, task tracking | Append-only — never edit or remove an entry |
| `open_items.md` | Deferred tasks, blockers, follow-ups that span sessions | Completed work, decisions | Remove an item the moment it's resolved |
| `changelog.md` | **What** was completed and **when**. Factual log only. | Opinions, rationale, open work | Append-only; keep full detail 30 days, summarize older entries |

Other files (`architecture.md`, `ROADMAP.md`, etc.) are reference docs — update them when the feature contracts or roadmap change.

Every maintenance pass evaluates all four files and captures only this session's **delta** — never
rewrite history or duplicate a prior entry; if a file needs no change, confirm it's current rather
than touching it. A **decision** exists when a technology, convention, design approach, or
tradeoff was resolved and you can articulate the reasoning and alternatives considered.

### When to update

Update PROJECT_NOTES automatically (without waiting to be asked) when any of the following occur:
- A task, feature, or milestone is completed
- A design or implementation decision was made
- The user signals session end or handoff ("I'll pick this up later", "let's stop here", "pushing now", etc.)
- A new file is created or significant feature is added
- A bug is fixed and verified
- Context threshold is approaching

### Scaffold templates

Use these verbatim when creating missing files:

**`current_state.md`**
```markdown
# Current State

_Last updated: <!-- YYYY-MM-DD -->_

## Objective
## Active Workstream
## Constraints
## Risks
## Next Actions
```

**`decisions.md`**
```markdown
# Decisions

Append-only. Records permanent architectural and design decisions.

<!-- Format:
## [YYYY-MM-DD] Title
**Decision:** **Reasoning:** **Alternatives rejected:** **Tradeoffs:**
-->
```

**`open_items.md`**
```markdown
# Open Items

Mutable. Remove an item when resolved.

<!-- Format:
## [YYYY-MM-DD] Title
**Status:** Blocked | Deferred | Pending input
**Description:** **Context:** **Next action:**
-->
```

**`changelog.md`**
```markdown
# Changelog

Append-only. Entries older than 30 days may be summarized but never deleted.

<!-- Format:
## [YYYY-MM-DD] Title
- What was completed (one line per item, include affected files/modules)
-->
```
