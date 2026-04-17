# TravelPlanner Promotion Workflow

Host-oriented automation script: `deployment/promotion.sh`

## Preconditions

- Host has both checkouts:
  - Prod: `/docker/openclaw-fbdq/data/.openclaw/workspace-sherlock/projects/travelplanner`
  - Staging: `/docker/openclaw-fbdq/data/.openclaw/workspace-sherlock/projects/travelplanner-staging`
- Shared env exists: `/docker/travelplanner/.env`
- `git` and `docker` available on host.
- Both repos have clean working trees.

## 1) Deploy a feature branch to staging

```bash
bash deployment/promotion.sh deploy-staging feature/<name>
```

What it does:
- Fetches `origin`
- Checks out `origin/feature/<name>` in the staging repo
- Redeploys staging with Docker Compose (`travelplanner-staging` project)

## 2) Promote from staging to main

```bash
bash deployment/promotion.sh promote --yes
```

What it does (deterministic order):
1. Reads current branch from staging checkout
2. Merges `origin/<staged-branch>` into prod `main` (fast-forward when possible, merge commit when branches diverged)
3. If merge conflicts occur, aborts the merge and exits with a clear error
4. Pushes `main`
5. Deletes feature branch locally + remote
6. Resets staging checkout back to `main`
7. Redeploys staging and prod (`travelplanner-staging`, `travelplanner-prod`)

## Safety checks

- Refuses to run if required paths/files are missing
- Refuses to promote if staging is already on `main`
- Refuses to continue with dirty git working trees
- Uses normal `git merge` semantics (`--no-edit`) so divergent histories are promoted safely
- If conflicts are detected during promote, aborts merge and exits without deleting branches/redeploying
- Requires explicit confirmation flag: `promote --yes`
