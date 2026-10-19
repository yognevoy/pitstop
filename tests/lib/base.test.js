import { test } from 'node:test';
import assert from 'node:assert/strict';
import { base, DEFAULT_SINCE } from '../../scripts/lib/base.js';
import { createFixtureRepo } from '../helpers/fixture-repo.js';

test('base: falls back when there is no previous run', () => {
  const repo = createFixtureRepo();
  try {
    repo.commit({ 'a.txt': 'one' });
    const result = base(repo.dir, null);
    assert.equal(result.method, 'fallback');
    assert.equal(result.base, null);
    assert.equal(result.since, DEFAULT_SINCE);
    assert.match(result.reason, /no previous run/);
  } finally {
    repo.cleanup();
  }
});

test('base: uses last_run.sha when it is an ancestor of HEAD', () => {
  const repo = createFixtureRepo();
  try {
    const sha1 = repo.commit({ 'a.txt': 'one' });
    repo.commit({ 'a.txt': 'two' });

    const result = base(repo.dir, sha1);
    assert.equal(result.method, 'last_run');
    assert.equal(result.base, sha1);
    assert.equal(result.since, null);
  } finally {
    repo.cleanup();
  }
});

test('base: falls back when last_run.sha is no longer an ancestor of HEAD (e.g. after a rebase)', () => {
  const repo = createFixtureRepo();
  try {
    const sha1 = repo.commit({ 'a.txt': 'one' });
    const abandonedSha = repo.commit({ 'a.txt': 'two' });

    repo.run(['reset', '--hard', sha1]);
    repo.commit({ 'a.txt': 'rewritten' }, { message: 'rewritten history' });

    const result = base(repo.dir, abandonedSha, '2 weeks ago');
    assert.equal(result.method, 'fallback');
    assert.equal(result.base, null);
    assert.equal(result.since, '2 weeks ago');
    assert.match(result.reason, /not an ancestor of HEAD/);
  } finally {
    repo.cleanup();
  }
});

test('base: falls back instead of throwing when last_run.sha is invalid', () => {
  const repo = createFixtureRepo();
  try {
    repo.commit({ 'a.txt': 'one' });
    const result = base(repo.dir, 'not-a-real-sha');
    assert.equal(result.method, 'fallback');
  } finally {
    repo.cleanup();
  }
});
