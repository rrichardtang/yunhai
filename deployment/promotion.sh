#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="/docker/travelplanner/.env"
HOST_ROOT="/docker/openclaw-fbdq/data/.openclaw/workspace-sherlock/projects"
PROD_REPO="${HOST_ROOT}/travelplanner"
STAGING_REPO="${HOST_ROOT}/travelplanner-staging"
COMPOSE_FILE="deployment/docker-compose.yml"

log() {
  printf '[promotion] %s\n' "$*"
}

die() {
  printf '[promotion][error] %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

require_paths() {
  [[ -f "$ENV_FILE" ]] || die "Missing env file: $ENV_FILE"
  [[ -d "$PROD_REPO/.git" ]] || die "Prod repo missing or not a git repo: $PROD_REPO"
  [[ -d "$STAGING_REPO/.git" ]] || die "Staging repo missing or not a git repo: $STAGING_REPO"
  [[ -f "$PROD_REPO/$COMPOSE_FILE" ]] || die "Missing compose file: $PROD_REPO/$COMPOSE_FILE"
  [[ -f "$STAGING_REPO/$COMPOSE_FILE" ]] || die "Missing compose file: $STAGING_REPO/$COMPOSE_FILE"
}

assert_clean_repo() {
  local repo="$1"
  local name="$2"
  if ! git -C "$repo" diff --quiet || ! git -C "$repo" diff --cached --quiet; then
    die "$name repo has uncommitted changes: $repo"
  fi
}

ensure_remote_branch_exists() {
  local repo="$1"
  local branch="$2"
  git -C "$repo" fetch --prune origin
  git -C "$repo" show-ref --verify --quiet "refs/remotes/origin/${branch}" || die "Remote branch origin/${branch} not found"
}

staging_current_branch() {
  git -C "$STAGING_REPO" rev-parse --abbrev-ref HEAD
}

redeploy_repo() {
  local repo="$1"
  local project="$2"
  log "Redeploying $project from $repo"
  docker compose \
    --project-name "$project" \
    --env-file "$ENV_FILE" \
    -f "$repo/$COMPOSE_FILE" \
    up -d --force-recreate
}

deploy_feature_to_staging() {
  local branch="${1:-}"
  [[ -n "$branch" ]] || die "Usage: $0 deploy-staging <feature-branch>"
  [[ "$branch" != "main" ]] || die "Refusing to deploy main as a feature branch"

  assert_clean_repo "$STAGING_REPO" "Staging"
  ensure_remote_branch_exists "$STAGING_REPO" "$branch"

  log "Deploying origin/${branch} to staging"
  git -C "$STAGING_REPO" checkout -B "$branch" "origin/$branch"
  redeploy_repo "$STAGING_REPO" "travelplanner-staging"

  log "Staging is now running branch: $branch"
}

promote_staging_to_main() {
  local yes_flag="${1:-}"
  [[ "$yes_flag" == "--yes" ]] || die "Usage: $0 promote --yes"

  assert_clean_repo "$STAGING_REPO" "Staging"
  assert_clean_repo "$PROD_REPO" "Prod"

  local branch
  branch="$(staging_current_branch)"
  [[ -n "$branch" ]] || die "Could not determine staging branch"
  [[ "$branch" != "main" ]] || die "Staging is already on main; nothing to promote"

  ensure_remote_branch_exists "$STAGING_REPO" "$branch"

  log "Promoting staging branch '$branch' into prod main"
  git -C "$PROD_REPO" fetch --prune origin
  git -C "$PROD_REPO" checkout main
  git -C "$PROD_REPO" reset --hard origin/main

  if ! git -C "$PROD_REPO" merge --no-edit "origin/$branch"; then
    log "Merge failed (likely conflicts). Aborting merge in prod repo."
    git -C "$PROD_REPO" merge --abort >/dev/null 2>&1 || true
    die "Could not merge origin/$branch into main cleanly. Resolve conflicts manually and re-run promotion."
  fi

  git -C "$PROD_REPO" push origin main

  log "Deleting feature branch '$branch' locally/remotely"
  git -C "$PROD_REPO" branch -D "$branch" >/dev/null 2>&1 || true
  git -C "$STAGING_REPO" branch -D "$branch" >/dev/null 2>&1 || true
  git -C "$PROD_REPO" push origin --delete "$branch"

  log "Resetting staging checkout to main"
  git -C "$STAGING_REPO" fetch --prune origin
  git -C "$STAGING_REPO" checkout main
  git -C "$STAGING_REPO" reset --hard origin/main

  redeploy_repo "$STAGING_REPO" "travelplanner-staging"
  redeploy_repo "$PROD_REPO" "travelplanner-prod"

  log "Promotion complete: main deployed to prod and staging reset to main"
}

usage() {
  cat <<'EOF'
Usage:
  promotion.sh deploy-staging <feature-branch>
  promotion.sh promote --yes

Commands:
  deploy-staging <feature-branch>  Check out origin/<feature-branch> in staging and redeploy staging
  promote --yes                    Promote currently staged branch to prod main,
                                   delete the feature branch, reset staging to main,
                                   and redeploy both environments
EOF
}

main() {
  local cmd="${1:-}"
  case "$cmd" in
    -h|--help|help|"")
      usage
      return
      ;;
  esac

  require_cmd git
  require_cmd docker
  require_paths

  case "$cmd" in
    deploy-staging)
      shift
      deploy_feature_to_staging "$@"
      ;;
    promote)
      shift
      promote_staging_to_main "$@"
      ;;
    *)
      die "Unknown command: $cmd"
      ;;
  esac
}

main "$@"
