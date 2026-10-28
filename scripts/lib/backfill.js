import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectDuplicates } from './duplication.js';
import { git } from './git.js';
import { existsAtHead } from './ignore.js';
import { metrics } from './metrics.js';
const WEEKLY_POINTS = 6;

/**
 * Synthesizes up to WEEKLY_POINTS past weekly snapshots (oldest first), so a
 * brand-new install's first report can already show trends.
 */
export function backfillMetrics(dir, paths) {
  const snapshots = [];

  for (const sha of weeklyShas(dir)) {
    const base = mkdtempSync(join(tmpdir(), 'pitstop-backfill-'));
    const worktreeDir = join(base, 'wt');

    try {
      git(dir, ['worktree', 'add', '--detach', '--no-checkout', worktreeDir, sha]);
      const presentPaths = paths.filter((path) => existsAtHead(worktreeDir, path));
      const scopeFiles = presentPaths.map((path) => ({ path, commits: 0, added: 0, deleted: 0 }));
      const duplicatesByFile = detectDuplicates(worktreeDir, presentPaths);
      const date = git(dir, ['show', '-s', '--format=%cI', sha]).trim();

      snapshots.push({
        version: 1,
        sha,
        date,
        files: metrics(worktreeDir, scopeFiles, [], duplicatesByFile),
        totals: { open_findings: 0 },
      });
    } finally {
      try {
        git(dir, ['worktree', 'remove', '--force', worktreeDir]);
      } catch {
      }

      rmSync(base, { recursive: true, force: true });
    }
  }

  return snapshots;
}

function weeklyShas(dir) {
  const shas = [];

  for (let weeksAgo = WEEKLY_POINTS; weeksAgo >= 1; weeksAgo -= 1) {
    const sha = git(dir, ['rev-list', '-1', `--before=${weeksAgo} weeks ago`, 'HEAD']).trim();

    if (sha && !shas.includes(sha)) {
      shas.push(sha);
    }
  }

  return shas;
}
