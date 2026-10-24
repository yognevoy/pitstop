import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function read(dir) {
  const findingsDir = join(dir, '.pitstop/findings');

  if (!existsSync(findingsDir)) {
    return [];
  }

  return readdirSync(findingsDir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => JSON.parse(readFileSync(join(findingsDir, name), 'utf8')));
}

// Matches new findings against the registry by id.
export function store(existing, findings, run) {
  const result = existing.map((record) => ({ ...record }));

  for (const finding of findings) {
    const id = recordId(finding.category, finding.anchors);
    const record = result.find((candidate) => candidate.id === id);

    if (record) {
      record.last_seen = { date: run.date, sha: run.sha };
      record.seen_count += 1;

      if (record.status === 'fixed') {
        record.status = 'open';
        record.history = [...record.history, { date: run.date, event: 'reopened' }];
      } else {
        record.history = [...record.history, { date: run.date, event: 'seen' }];
      }

      continue;
    }

    result.push({
      id,
      ...finding,
      status: 'open',
      status_reason: null,
      first_seen: { date: run.date, sha: run.sha },
      last_seen: { date: run.date, sha: run.sha },
      seen_count: 1,
      history: [{ date: run.date, event: 'opened' }],
    });
  }

  return result;
}

// Keeps a finding unless its matching record fails isIncluded.
export function selectFindings(findings, registry, isIncluded) {
  const recordsById = new Map(registry.map((record) => [record.id, record]));

  return findings.filter((finding) => {
    const record = recordsById.get(recordId(finding.category, finding.anchors));
    return !record || isIncluded(record);
  });
}

// Groups records matching isMatch by anchor file, for files in this run's scope.
export function scoped(records, isMatch, scopeFiles) {
  const scopeSet = new Set(scopeFiles);
  const byFile = {};

  for (const record of records) {
    if (!isMatch(record)) {
      continue;
    }

    for (const anchor of record.anchors) {
      if (!scopeSet.has(anchor.file)) {
        continue;
      }

      byFile[anchor.file] ??= [];
      byFile[anchor.file].push({ id: record.id, title: record.title });
    }
  }

  return byFile;
}

const STATUSES = ['open', 'fixed', 'wontfix'];

// Changes one record's status by id. wontfix requires a reason, cleared
// when the status is anything else.
export function setStatus(records, id, status, { reason, today }) {
  if (!STATUSES.includes(status)) {
    throw new Error(`Unknown status "${status}". Expected one of: ${STATUSES.join(', ')}.`);
  }

  if (status === 'wontfix' && !reason) {
    throw new Error('wontfix requires a reason.');
  }

  if (!records.some((record) => record.id === id)) {
    throw new Error(`No finding with id "${id}".`);
  }

  return records.map((record) => {
    if (record.id !== id) {
      return record;
    }

    return {
      ...record,
      status,
      status_reason: status === 'wontfix' ? reason : null,
      history: [...record.history, { date: today, event: status }],
    };
  });
}

export function recordId(category, anchors) {
  const files = anchors.map((anchor) => anchor.file).sort();
  const hash = createHash('sha1').update(`${category}\n${files.join('|')}`).digest('hex').slice(0, 8);

  return `f_${hash}`;
}
