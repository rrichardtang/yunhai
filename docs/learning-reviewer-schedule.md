# Learning Reviewer (Twice Daily)

Run twice daily (UTC):

```cron
0 3,15 * * * cd /data/.openclaw/workspace-sherlock/projects/travelplanner && npm run review:learn >> data/learning_reviewer.log 2>&1
```

Script: `scripts/sherlock-learning-review.js`

- Detects new commits since last reviewed commit
- If none: outputs `No changes made.`
- If new commits: synthesizes concise learnings + 1-line actionables from:
  - new commit subjects
  - `PROJECT_NOTES/changelog.md`
  - `PROJECT_NOTES/decisions.md`
  - `docs/decisions.md`
- Writes report `sherlock_learning_report_<timestamp>.md`
  - Preferred: `PROJECT_NOTES/`
  - Fallback (if PROJECT_NOTES not writable): `data/PROJECT_NOTES_FALLBACK/`
