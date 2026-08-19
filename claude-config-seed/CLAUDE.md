# User-level Claude Code config

Synced from `rrichardtang/claude-config` — see that repo's `README.md` for how the sync works.
This file loads in every session, on every project, before that project's own `CLAUDE.md`.

## caveman

The `caveman` skill (ultra-compressed output, ~65% token cut) is installed and available via
`/caveman` or by saying "caveman mode" / "less tokens" / etc. **It is off by default in
interactive sessions** — nothing here turns it on automatically. `bob-the-builder` and
`felix-the-fixer` (below) each turn it on for themselves as their first action, since they're
the token/latency-sensitive part of this setup; the main session stays normal prose unless you
ask for it directly.

## Coding ↔ Review Loop (opt-in)

`bob-the-builder` (implements) and `felix-the-fixer` (reviews) can work a plan back and forth
instead of you driving every change by hand. **This is opt-in** — only run it when explicitly
asked to, after a plan has been approved. Most tasks are still handled directly.

When running it:
- **Cap at 3 rounds** of `bob-the-builder` → `felix-the-fixer`. This is a hard cutoff, not a
  suggestion — an unbounded review loop is worse than a bounded one that sometimes needs a human.
- **Round 1:** `bob-the-builder` implements against the approved plan; `felix-the-fixer` reviews
  the diff.
- **Round 2+:** carry forward *every* prior round's findings into `bob-the-builder`'s next
  prompt — subagents are stateless per spawn, they don't remember earlier rounds on their own.
  `bob-the-builder` states up front whether the previous fix addressed the review's root cause
  or only patched the flagged lines before making new edits. Recurring or reshaped findings
  across rounds are the signal to fix the underlying cause, not keep patching symptoms — and
  `felix-the-fixer` is instructed to call this out explicitly as "not converging" when it sees it.
- **After round 3**, if `felix-the-fixer` still finds issues: stop. Do not start a 4th round
  automatically. Summarize what's still wrong and ask how to proceed.

**Notes boundary:** if the repo you're in has a living-notes convention (a `PROJECT_NOTES/`
directory or equivalent), only the orchestrating (main) agent reads and writes it. Extract just
the task-relevant slice — the specific bug, decision, or preference that matters for this task —
into what you send `bob-the-builder`/`felix-the-fixer`; don't have them read the file directly.
After they report a completed round, you decide what (if anything) graduates into that repo's
notes. `bob-the-builder` and `felix-the-fixer` each keep their own smaller, role-scoped log
instead — `.claude/agent-notes/bob.md` and `.claude/agent-notes/felix.md` in whatever repo
they're working in — for things future rounds of *that specific role* should know, separate from
the project's higher-level notes.
