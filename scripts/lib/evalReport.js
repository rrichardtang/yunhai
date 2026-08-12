// Verdict and markdown for a prompt-vs-prompt run. Written into data/bakeoff/
// so the existing owner-gated /debug/bakeoff route serves it with no new
// endpoint — the run happens wherever the API keys live and the numbers have to
// travel back to whoever decides.
const path = require('path');

// The threshold a judge criterion must clear to count as a regression. It is a
// starting value, not a measured one: run the same prompt against itself three
// times and set it above whatever that noise floor turns out to be.
const JUDGE_LOSS_MARGIN = 2;

// Regression is decided on counts, not on which findings differ. Two runs of a
// non-deterministic model repeat different restaurants, so a detail-level diff
// would call every lateral move a regression — and a harness that cries wolf
// gets switched off. The details ride along only to say what to go look at.
function invariantDeltas(perScenario) {
  const deltas = [];
  for (const row of perScenario) {
    const checks = new Set([...Object.keys(row.baselineChecks.byCheck), ...Object.keys(row.candidateChecks.byCheck)]);
    for (const check of checks) {
      const base = row.baselineChecks.byCheck[check] || 0;
      const cand = row.candidateChecks.byCheck[check] || 0;
      const details = row.candidateChecks.findings.filter((f) => f.check === check).map((f) => f.detail);
      deltas.push({ scenario: row.scenario, check, base, cand, regressed: cand > base, details });
    }
  }
  return deltas;
}

function deltaNote({ base, cand, regressed, details }) {
  if (!regressed) return cand === 0 ? 'clean' : 'held';
  const shown = details.slice(0, 2).join('; ');
  const more = details.length > 2 ? ` (+${details.length - 2} more)` : '';
  return `+${cand - base} · ${shown}${more}`;
}

function verdictFor({ deltas, tally }) {
  const reasons = [];
  const regressions = deltas.filter((d) => d.regressed);
  if (regressions.length) {
    const scenarios = [...new Set(regressions.map((r) => r.scenario))];
    reasons.push(`${regressions.length} new invariant finding${regressions.length === 1 ? '' : 's'} (${scenarios.join(', ')})`);
  }
  for (const [criterion, counts] of Object.entries(tally || {})) {
    if (counts.baseline - counts.candidate >= JUDGE_LOSS_MARGIN) {
      reasons.push(`${criterion} lost ${counts.baseline}–${counts.candidate}`);
    }
  }
  return { status: reasons.length ? 'DEGRADED' : 'PASS', reasons };
}

const cell = (value) => (value == null ? '—' : value);

function renderReport({
  title,
  perScenario,
  tally,
  judgeNotes = [],
  run = {},
  outDir,
  artifactName = (id) => `eval-${id}-candidate.json`,
  reportName = 'judge-report.md'
}) {
  const deltas = invariantDeltas(perScenario);
  const verdict = verdictFor({ deltas, tally });
  const lines = [];

  lines.push(`# ${title} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`);
  lines.push('');
  lines.push(`VERDICT: ${verdict.status}`);
  for (const reason of verdict.reasons) lines.push(`  · ${reason}`);
  if (!verdict.reasons.length) lines.push('  · no new invariant findings, no judge criterion lost by the margin');
  lines.push('');

  lines.push('## Invariants — no LLM, exact');
  lines.push('| scenario | check | base | cand | |');
  lines.push('|---|---|---:|---:|---|');
  for (const d of deltas.sort((a, b) => Number(b.regressed) - Number(a.regressed))) {
    lines.push(`| ${d.scenario} | ${d.check} | ${d.base} | ${d.cand} | ${deltaNote(d)} |`);
  }
  if (!deltas.length) lines.push('| — | no findings on either arm | 0 | 0 | |');
  lines.push('');

  if (tally && Object.keys(tally).length) {
    lines.push(`## Judge — ${run.judgeModel || 'unknown'}, pairwise, position-swapped`);
    lines.push('| criterion | base | cand | tie |');
    lines.push('|---|---:|---:|---:|');
    for (const [criterion, counts] of Object.entries(tally)) {
      lines.push(`| ${criterion} | ${counts.baseline} | ${counts.candidate} | ${counts.tie} |`);
    }
    lines.push('');
    lines.push('Only calls that survived the position swap appear as a win. Where the judge picked');
    lines.push('the same slot in both orderings it is counted a tie, because that is bias and not a');
    lines.push('preference.');
    lines.push('');
    if (judgeNotes.length) {
      lines.push('### Where it turned');
      for (const note of judgeNotes) lines.push(`- **${note.criterion}** · ${note.scenario} — ${note.winner} won: ${note.reason}`);
      lines.push('');
    }
  }

  lines.push('## Run');
  lines.push('```');
  for (const [key, value] of Object.entries(run)) lines.push(`${key.padEnd(12)} ${cell(value)}`);
  lines.push('```');
  lines.push('');
  lines.push('Per-scenario output is beside this file:');
  for (const row of perScenario) {
    lines.push(`  /debug/bakeoff?file=${encodeURIComponent(artifactName(row.scenario))}`);
  }
  lines.push('');
  lines.push(`Written to ${path.relative(process.cwd(), path.join(outDir, reportName))}`);

  return { text: lines.join('\n'), verdict, deltas };
}

module.exports = { renderReport, verdictFor, invariantDeltas, JUDGE_LOSS_MARGIN };
