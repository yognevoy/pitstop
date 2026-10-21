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
      record.history = [...record.history, { date: run.date, event: 'seen' }];
      continue;
    }

    result.push({
      id,
      ...finding,
      status: 'open',
      status_reason: null,
      deferred_until: null,
      first_seen: { date: run.date, sha: run.sha },
      last_seen: { date: run.date, sha: run.sha },
      seen_count: 1,
      history: [{ date: run.date, event: 'opened' }],
    });
  }

  return result;
}

function recordId(category, anchors) {
  const files = anchors.map((anchor) => anchor.file).sort();
  const hash = createHash('sha1').update(`${category}\n${files.join('|')}`).digest('hex').slice(0, 8);

  return `f_${hash}`;
}
