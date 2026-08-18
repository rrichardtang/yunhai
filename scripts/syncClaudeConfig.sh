#!/usr/bin/env bash
# SessionStart hook: syncs the global caveman skill + bob-the-builder/felix-the-fixer subagents
# from rrichardtang/claude-config into ~/.claude/ before the agent starts working.
#
# Container ~/.claude/ doesn't survive a fresh session, so this re-materializes it from the repo
# every time instead. Must not block or fail the session: a network hiccup or missing repo access
# should degrade to "no sync this session," not an unusable container. This assumes
# rrichardtang/claude-config is public — a plain `git clone` here has no credentials to offer, so
# a private repo only syncs in a session that has separately been granted access to it.
#
# Runs main@HEAD unpinned and executes its install.sh unconditionally — accepted as-is since it's
# the same account's own dotfiles repo, not third-party code; see decisions.md [2026-08-18].
set -uo pipefail

CACHE_DIR="${CLAUDE_CONFIG_CACHE:-${HOME:-/tmp}/.claude-config-src}"
REMOTE="https://github.com/rrichardtang/claude-config.git"
export GIT_TERMINAL_PROMPT=0

if [ -d "$CACHE_DIR/.git" ]; then
  timeout 30 git -C "$CACHE_DIR" pull --ff-only origin main || {
    echo "syncClaudeConfig: pull failed, using existing cached copy at $CACHE_DIR" >&2
  }
else
  rm -rf "$CACHE_DIR"
  timeout 30 git clone --depth 1 "$REMOTE" "$CACHE_DIR" || {
    echo "syncClaudeConfig: clone failed — skipping global config sync this session" >&2
    rm -rf "$CACHE_DIR"
    exit 0
  }
fi

if [ -x "$CACHE_DIR/install.sh" ]; then
  timeout 30 bash "$CACHE_DIR/install.sh" || echo "syncClaudeConfig: install.sh failed or timed out" >&2
else
  echo "syncClaudeConfig: $CACHE_DIR/install.sh missing or not executable — skipping" >&2
fi

exit 0
