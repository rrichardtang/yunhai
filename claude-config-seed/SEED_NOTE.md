# Temporary staging directory — not part of TravelPlannerAgent

These files belong in `rrichardtang/claude-config`, the dotfiles repo that
`scripts/syncClaudeConfig.sh` clones into `~/.claude/` at session start. They are staged here
only because the session that authored them could not push to that repo: the agent git proxy
refuses to issue a credential for any repo outside the session's authorized source set, and the
`add_repo` tool that would add one is blocked at the MCP permission layer. Staging them in a repo
that *is* pushable keeps them from being lost with the container.

**To finish the move**, from a session that has `rrichardtang/claude-config` as a configured
source, copy the contents of this directory to that repo's root, commit, push to `main`, then
delete this directory from GuideMe. Nothing in TravelPlannerAgent imports or executes anything
here — `syncClaudeConfig.sh` reads from the cloned copy of `claude-config`, never from this path,
so leaving it in place is inert but pointless once the move is done.

Contents: the `caveman` skill (vendored from https://github.com/JuliusBrussee/caveman, MIT), the
`bob-the-builder` and `felix-the-fixer` subagent definitions, the user-level `CLAUDE.md` carrying
the opt-in loop protocol, `install.sh`, and the repo's own `README.md`.
