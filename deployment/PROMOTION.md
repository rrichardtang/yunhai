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
2. Fast-forward merges `origin/<staged-branch>` into prod `main`
3. Pushes `main`
4. Deletes feature branch locally + remote
5. Resets staging checkout back to `main`
6. Redeploys staging and prod (`travelplanner-staging`, `travelplanner-prod`)

## Safety checks

- Refuses to run if required paths/files are missing
- Refuses to promote if staging is already on `main`
- Refuses to continue with dirty git working trees
- Uses `--ff-only` merge to avoid accidental merge commits
- Requires explicit confirmation flag: `promote --yes`
