#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const notesDir = path.join(repoRoot, 'PROJECT_NOTES');
const discoveriesDir = '/data/.openclaw/workspace-sherlock/notes/discoveries/travelplanner';

function canWriteDir(dir) {
  try {
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

const outputDir = discoveriesDir;

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const statePath = path.join(outputDir, '.learning_reviewer_state.json');

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function run(cmd) {
  return execSync(cmd, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

function getHead() {
  return run('git rev-parse HEAD');
}

function getNewCommits(lastReviewed) {
  const range = lastReviewed ? `${lastReviewed}..HEAD` : 'HEAD~20..HEAD';
  try {
    const raw = run(`git log --pretty=format:%H%x09%s ${range}`);
    if (!raw) return [];
    return raw
      .split('\n')
      .map((line) => {
        const [hash, ...subjectParts] = line.split('\t');
        return { hash, subject: subjectParts.join('\t').trim() };
      })
      .filter((c) => c.hash && c.subject);
  } catch {
    return [];
  }
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch {
    return {};
  }
}

function writeState(state) {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');
}

function summarize(commits, contextText) {
  const learnings = [];
  const actionables = [];

  if (commits.length) {
    const topSubjects = commits.slice(0, 3).map((c) => c.subject);
    learnings.push(`Recent delivery themes: ${topSubjects.join(' | ')}`);
  }

  const text = contextText.toLowerCase();

  if (text.includes('auto arrange') || text.includes('heuristic') || text.includes('/api/arrange')) {
    learnings.push('Complex scheduling constraints are more reliable when centralized in one orchestration path instead of scattered heuristics.');
    actionables.push('When schedule logic grows brittle, prefer one constraint-driven planner endpoint with explicit fallback errors.');
  }

  if (text.includes('profile') || text.includes('distillation') || text.includes('preferences')) {
    learnings.push('Preference memory quality improves when raw signals are periodically distilled into a compact canonical profile.');
    actionables.push('Add lightweight compaction checkpoints so preference state stays concise and reusable across sessions.');
  }

  if (text.includes('context') || text.includes('token') || text.includes('payload') || text.includes('cached prompt')) {
    learnings.push('Chat reliability and cost both improve when context is aggressively trimmed to decision-critical fields.');
    actionables.push('Before expanding prompts, remove non-essential fields and cache stable prompt sections per trip/session.');
  }

  if (text.includes('autocomplete') || text.includes('rendercities') || text.includes('re-render')) {
    learnings.push('Input widgets tied to third-party SDKs break under broad re-renders; update state surgically during typing flows.');
    actionables.push('Guard render paths for active inputs so external widgets are not torn down mid-interaction.');
  }

  if (text.includes('single source of truth') || text.includes('auto-populate') || text.includes('city main row')) {
    learnings.push('Date/time UX is more stable when one upstream field drives all downstream defaults.');
    actionables.push('Define one canonical owner for shared fields (dates/times) and derive secondary values from it.');
  }

  if (!learnings.length) {
    learnings.push('Changes were made, but no dominant cross-cutting pattern was detected from commit + notes metadata.');
  }

  if (!actionables.length) {
    actionables.push('Continue appending concise changelog + decisions entries so future synthesis stays high-signal.');
  }

  return {
    learnings: Array.from(new Set(learnings)).slice(0, 6),
    actionables: Array.from(new Set(actionables)).slice(0, 5),
  };
}

function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function enforceSentenceLimit(text, maxSentences) {
  const sentences = splitSentences(text);
  if (!sentences.length) return text.trim();
  return sentences.slice(0, maxSentences).join(' ');
}

function clampInsightText(text) {
  return enforceSentenceLimit(text, 4);
}

function buildRows(learnings, actionables) {
  const maxRows = Math.max(learnings.length, actionables.length);
  const rows = [];

  for (let i = 0; i < maxRows; i += 1) {
    const insight = learnings[i] || '';
    const action = actionables[i] || '';
    const why = enforceSentenceLimit(insight, 2);

    rows.push({
      insight: clampInsightText(insight),
      why,
      action: clampInsightText(action),
    });
  }

  return rows;
}

function tableEscape(text) {
  return String(text || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function formatTimestamp(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}_${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

function main() {
  const state = readState();
  const head = getHead();
  const commits = getNewCommits(state.lastReviewedCommit);
  const nowIso = new Date().toISOString();
  const ts = formatTimestamp();
  const reportPath = path.join(outputDir, `sherlock_learning_report_${ts}.md`);

  if (!commits.length) {
    const noChanges = [
      `# Sherlock Learning Report (${nowIso})`,
      '',
      '| Insight | Why ≤2s | Action ≤2s |',
      '| --- | --- | --- |',
      '| No new commits detected. | No new work to synthesize in this run. | Run again after additional commits. |',
      '',
    ].join('\n');
    fs.writeFileSync(reportPath, noChanges);
    console.log('No changes made.');
    return;
  }

  const contextText = [
    safeRead(path.join(notesDir, 'changelog.md')),
    safeRead(path.join(notesDir, 'decisions.md')),
    safeRead(path.join(repoRoot, 'docs', 'decisions.md')),
  ].join('\n\n');

  const { learnings, actionables } = summarize(commits, contextText);
  const rows = buildRows(learnings, actionables);

  const lines = [];
  lines.push(`# Sherlock Learning Report (${nowIso})`);
  lines.push('');
  lines.push('| Insight | Why ≤2s | Action ≤2s |');
  lines.push('| --- | --- | --- |');
  for (const row of rows) {
    lines.push(`| ${tableEscape(row.insight)} | ${tableEscape(row.why)} | ${tableEscape(row.action)} |`);
  }
  lines.push('');

  const content = lines.join('\n');
  fs.writeFileSync(reportPath, content);

  writeState({
    lastReviewedCommit: head,
    lastRunAt: nowIso,
    lastReport: path.basename(reportPath),
  });

  console.log(content);
}

main();
