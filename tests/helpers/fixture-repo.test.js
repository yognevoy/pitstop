import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createFixtureRepo } from './fixture-repo.js';

test('fixture repo: creates commits with given files, dates, and authors, then cleans up', () => {
  const repo = createFixtureRepo();
  try {
    const sha1 = repo.commit({ 'a.txt': 'one' }, { message: 'first', date: '2024-01-01T00:00:00Z' });
    const sha2 = repo.commit(
      { 'a.txt': 'two', 'b.txt': 'new' },
      { message: 'second', date: '2024-02-01T00:00:00Z', author: { name: 'Someone', email: 'someone@example.com' } },
    );

    assert.notEqual(sha1, sha2);
    assert.equal(readFileSync(join(repo.dir, 'a.txt'), 'utf8'), 'two');

    const log = repo.run(['log', '--format=%H %an %aI', '--no-renames']);
    assert.match(log, new RegExp(`^${sha2} Someone 2024-02-01`));
    assert.match(log, new RegExp(`${sha1} Fixture 2024-01-01`));
  } finally {
    repo.cleanup();
  }

  assert.equal(existsSync(repo.dir), false);
});
