import { rankFindings } from './rank-findings.js';

const SEVERITIES = ['must', 'should', 'nice'];
const SEVERITY_HEADINGS = { must: 'Must fix', should: 'Should fix', nice: 'Nice to have' };

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

  let number = 0;
  const sections = [];

  for (const severity of SEVERITIES) {
    const group = findings.filter((finding) => finding.severity === severity);

    if (group.length === 0) {
      continue;
    }

    const items = group.map((finding) => renderFinding(finding, ++number));
    sections.push(`## ${SEVERITY_HEADINGS[severity]}\n\n${items.join('\n\n')}`);
  }

  return sections.join('\n\n');
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
