import { rankFindings } from './rank-findings.js';

const SEVERITIES = ['must', 'should', 'nice'];

/**
 * Fills in the report template with the run's results.
 */
export function report(template, scope, findings, topK) {
  const top = rankFindings(findings, topK);
  const remaining = findings.length - top.length;

  return template
    .replace('{{date}}', scope.generated_at.slice(0, 10))
    .replace('{{period}}', describePeriod(scope.base))
    .replace('{{base}}', scope.base.reason)
    .replace('{{file_count}}', String(scope.files.length))
    .replace('{{finding_summary}}', describeFindingSummary(findings))
    .replace('{{findings}}', renderFindings(top))
    .replace('{{more_line}}', describeMoreLine(remaining));
}

function describePeriod(base) {
  if (base.method === 'last_run') {
    return `${base.base}..HEAD`;
  }

  return `${base.since} → HEAD`;
}

function describeFindingSummary(findings) {
  const plural = findings.length === 1 ? '' : 's';

  if (findings.length === 0) {
    return `**0 finding${plural}**`;
  }

  const counts = { must: 0, should: 0, nice: 0 };
  for (const finding of findings) {
    counts[finding.severity]++;
  }

  const breakdown = SEVERITIES.filter((severity) => counts[severity] > 0)
    .map((severity) => `${counts[severity]} ${severity}`)
    .join(', ');

  return `**${findings.length} finding${plural}** (${breakdown})`;
}

function renderFindings(findings) {
  if (findings.length === 0) {
    return 'No findings this run.';
  }

  const bySeverity = [...findings].sort(
    (a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity),
  );

  const table = renderTable(bySeverity);
  const details = bySeverity.map((finding, index) => renderFinding(finding, index + 1));

  return [table, ...details].join('\n\n');
}

function renderTable(findings) {
  const header = '| # | Severity | Category | File | Title | Effort |';
  const divider = '|---|----------|----------|------|-------|--------|';
  const rows = findings.map((finding, index) => {
    const files = finding.anchors.map((anchor) => anchor.file).join(', ');
    return `| ${index + 1} | ${finding.severity} | ${finding.category} | ${files} | ${finding.title} | ${finding.effort} |`;
  });

  return [header, divider, ...rows].join('\n');
}

function renderFinding(finding, number) {
  return [
    `### ${number}. ${finding.title}`,
    `*${finding.category} · ${finding.severity} · effort ${finding.effort}*`,
    `**What:** ${finding.what}`,
    `**Problem:** ${finding.problem}`,
    `**Fix:** ${finding.fix}`,
    `**If skipped:** ${finding.if_skipped}`,
  ].join('\n\n');
}

function describeMoreLine(remaining) {
  if (remaining <= 0) {
    return '';
  }

  const plural = remaining === 1 ? '' : 's';
  return `${remaining} more finding${plural} below the cut.`;
}
