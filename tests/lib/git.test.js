import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { git, GitError } from '../../scripts/lib/git.js';
import { createFixtureRepo } from '../helpers/fixture-repo.js';

test('git: throws a clear GitError when the directory is not a git repository', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pitstop-not-a-repo-'));
  try {
    assert.throws(() => git(dir, ['rev-parse', 'HEAD']), (err) => {
      assert.ok(err instanceof GitError);
      assert.match(err.message, /not a git repository/i);
      return true;
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('git: runs a command in a real repo and returns stdout', () => {
  const repo = createFixtureRepo();
  try {
    const sha = repo.commit({ 'a.txt': 'one' });
    const out = git(repo.dir, ['rev-parse', 'HEAD']);
    assert.equal(out.trim(), sha);
  } finally {
    repo.cleanup();
  }
});

test('git: throws a GitError carrying git\'s own stderr for other failures', () => {
  const repo = createFixtureRepo();
  try {
    assert.throws(() => git(repo.dir, ['not-a-real-git-command']), (err) => {
      assert.ok(err instanceof GitError);
      assert.match(err.message, /not-a-real-git-command/);
      return true;
    });
  } finally {
    repo.cleanup();
  }
});
