import { test } from 'node:test';
import assert from 'node:assert/strict';
import { backfillMetrics } from '../../scripts/lib/backfill.js';
import { createFixtureRepo } from '../helpers/fixture-repo.js';

function weeksAgoIso(weeks, from = Date.now()) {
  return new Date(from - weeks * 7 * 24 * 60 * 60 * 1000).toISOString();
}

test('backfillMetrics: synthesizes one snapshot for a commit older than a week, from its own worktree content', () => {
  const repo = createFixtureRepo();
  try {
    const now = Date.now();
    const oldSha = repo.commit({ 'a.js': 'one\n' }, { date: weeksAgoIso(8, now) });
    repo.commit({ 'a.js': 'one\ntwo\n' }, { date: new Date(now).toISOString() });

    const snapshots = backfillMetrics(repo.dir, ['a.js']);

    assert.equal(snapshots.length, 1);
    assert.equal(snapshots[0].sha, oldSha);
    assert.equal(snapshots[0].totals.open_findings, 0);
    assert.deepEqual(
      snapshots[0].files.map((file) => ({ path: file.path, loc: file.loc })),
      [{ path: 'a.js', loc: 1 }],
    );
  } finally {
    repo.cleanup();
  }
});

test('backfillMetrics: omits a path that did not exist yet at a historical point', () => {
  const repo = createFixtureRepo();
  try {
    const now = Date.now();
    repo.commit({ 'a.js': 'one\n' }, { date: weeksAgoIso(8, now) });
    repo.commit({ 'a.js': 'one\n', 'b.js': 'new\n' }, { date: new Date(now).toISOString() });

    const snapshots = backfillMetrics(repo.dir, ['a.js', 'b.js']);

    assert.equal(snapshots.length, 1);
    assert.deepEqual(snapshots[0].files.map((file) => file.path), ['a.js']);
  } finally {
    repo.cleanup();
  }
});

test('backfillMetrics: returns no snapshots when every commit is less than a week old', () => {
  const repo = createFixtureRepo();
  try {
    repo.commit({ 'a.js': 'one\n' }, { date: new Date().toISOString() });

    assert.deepEqual(backfillMetrics(repo.dir, ['a.js']), []);
  } finally {
    repo.cleanup();
  }
});
