import { rankFindings } from './rank-findings.js';

/**
 * Fills in the report template with the run's results.
 */
export function report(template, scope, findings, topK) {
  const top = rankFindings(findings, topK);
  const remaining = findings.length - top.length;

  return template
    .replace('{{period}}', describePeriod(scope.base))
    .replace('{{base}}', scope.base.reason)
    .replace('{{level}}', scope.level)
    .replace('{{file_count}}', String(scope.files.length))
    .replace('{{findings}}', renderFindings(top))
    .replace('{{more_line}}', describeMoreLine(remaining));
}

function describePeriod(base) {
  if (base.method === 'last_run') {
    return `${base.base}..HEAD`;
  }

  return `${base.since} → HEAD`;
}

function renderFindings(findings) {
  if (findings.length === 0) {
    return 'No findings this run.';
  }

  return findings.map(renderFinding).join('\n\n');
}

function renderFinding(finding) {
  return [
    `### ${finding.title}`,
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
