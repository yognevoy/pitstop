import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { scope } from '../scripts/scope.js';
import { createFixtureRepo } from './helpers/fixture-repo.js';

function writeState(repo, sha) {
  const dir = join(repo.dir, '.pitstop');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'state.json'), JSON.stringify({ last_run: { sha } }));
}

test('scope: produces a scope with ranked files when there is no previous run', () => {
  const repo = createFixtureRepo();
  try {
    repo.commit({ 'a.js': 'one' }, { date: '2026-10-18T00:00:00Z' });
    repo.commit({ 'a.js': 'two', 'b.js': 'x' }, { date: '2026-10-19T00:00:00Z' });

    const result = scope(repo.dir, 'full');

    assert.equal(result.version, 1);
    assert.equal(result.level, 'full');
    assert.equal(result.base.method, 'fallback');
    assert.deepEqual(result.files.map((f) => f.path), ['a.js', 'b.js']);
  } finally {
    repo.cleanup();
  }
});

test('scope: diffs only since last_run.sha when it is a valid ancestor', () => {
  const repo = createFixtureRepo();
  try {
    const sha1 = repo.commit({ 'a.js': 'one' });
    repo.commit({ 'a.js': 'two', 'b.js': 'x' });
    writeState(repo, sha1);

    const result = scope(repo.dir, 'full');

    assert.equal(result.base.method, 'last_run');
    assert.equal(result.base.base, sha1);
    assert.deepEqual(result.files.map((f) => f.path), ['a.js', 'b.js']);
  } finally {
    repo.cleanup();
  }
});

test('scope: falls back when last_run.sha is no longer an ancestor (e.g. after a rebase)', () => {
  const repo = createFixtureRepo();
  try {
    const sha1 = repo.commit({ 'a.js': 'one' }, { date: '2026-10-18T00:00:00Z' });
    const abandonedSha = repo.commit({ 'a.js': 'two' }, { date: '2026-10-19T00:00:00Z' });

    repo.run(['reset', '--hard', sha1]);
    repo.commit({ 'a.js': 'rewritten' }, { message: 'rewritten history', date: '2026-10-19T00:00:00Z' });
    writeState(repo, abandonedSha);

    const result = scope(repo.dir, 'full');

    assert.equal(result.base.method, 'fallback');
    assert.match(result.base.reason, /not an ancestor of HEAD/);
    assert.deepEqual(result.files.map((f) => f.path), ['a.js']);
  } finally {
    repo.cleanup();
  }
});

test('scope: drops built-in-ignored and .pitstopignore-matched files', () => {
  const repo = createFixtureRepo();
  try {
    const setupSha = repo.commit({ '.pitstopignore': 'secrets/\n' }, { date: '2026-10-18T00:00:00Z' });

    repo.commit(
      {
        'a.js': 'kept',
        'package-lock.json': 'x',
        'secrets/token.txt': 'x',
      },
      { date: '2026-10-19T00:00:00Z' },
    );

    writeState(repo, setupSha);
    const result = scope(repo.dir, 'full');

    assert.deepEqual(result.files.map((f) => f.path), ['a.js']);
  } finally {
    repo.cleanup();
  }
});

test('scope: an empty range (no commits since last_run.sha) yields no files, not an error', () => {
  const repo = createFixtureRepo();
  try {
    const sha = repo.commit({ 'a.js': 'one' });
    writeState(repo, sha);

    const result = scope(repo.dir, 'full');

    assert.equal(result.base.method, 'last_run');
    assert.deepEqual(result.files, []);
  } finally {
    repo.cleanup();
  }
});
