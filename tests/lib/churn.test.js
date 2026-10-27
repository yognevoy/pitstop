import { test } from 'node:test';
import assert from 'node:assert/strict';
import { churn } from '../../scripts/lib/churn.js';
import { createFixtureRepo } from '../helpers/fixture-repo.js';

const IDENTITY_ENV = {
  GIT_AUTHOR_NAME: 'Fixture',
  GIT_AUTHOR_EMAIL: 'fixture@example.com',
  GIT_AUTHOR_DATE: '2024-03-01T00:00:00Z',
  GIT_COMMITTER_NAME: 'Fixture',
  GIT_COMMITTER_EMAIL: 'fixture@example.com',
  GIT_COMMITTER_DATE: '2024-03-01T00:00:00Z',
};

test('churn: counts commits and added/deleted lines per file across commits', () => {
  const repo = createFixtureRepo();
  try {
    repo.commit({ 'a.txt': 'l1\nl2\nl3\n' });
    repo.commit({ 'a.txt': 'l1\nl2\nl3\nl4\n', 'b.txt': 'x\n' });

    const result = churn(repo.dir, ['HEAD']);
    assert.deepEqual(result, {
      'a.txt': { commits: 2, added: 4, deleted: 0 },
      'b.txt': { commits: 1, added: 1, deleted: 0 },
    });
  } finally {
    repo.cleanup();
  }
});

test('churn: treats binary file changes as 0 added/0 deleted instead of crashing', () => {
  const repo = createFixtureRepo();
  try {
    repo.commit({ 'bin.dat': 'abc\0def' });

    const result = churn(repo.dir, ['HEAD']);
    assert.deepEqual(result['bin.dat'], { commits: 1, added: 0, deleted: 0 });
  } finally {
    repo.cleanup();
  }
});

test('churn: attributes a rename to the new path', () => {
  const repo = createFixtureRepo();
  try {
    repo.commit({ 'old.txt': 'l1\nl2\nl3\nl4\nl5\n' });
    repo.run(['mv', 'old.txt', 'new.txt']);
    repo.run(['commit', '-q', '-m', 'rename'], IDENTITY_ENV);

    const result = churn(repo.dir, ['HEAD']);
    assert.deepEqual(result['old.txt'], { commits: 1, added: 5, deleted: 0 });
    assert.deepEqual(result['new.txt'], { commits: 1, added: 0, deleted: 0 });
  } finally {
    repo.cleanup();
  }
});

test('churn: a pathspec narrows the result to files under that directory', () => {
  const repo = createFixtureRepo();
  try {
    repo.commit({ 'local/a.txt': 'one', 'vendor/b.txt': 'one' });

    const result = churn(repo.dir, ['HEAD'], ['local/']);
    assert.deepEqual(Object.keys(result), ['local/a.txt']);
  } finally {
    repo.cleanup();
  }
});

test('churn: returns an empty result for an empty range', () => {
  const repo = createFixtureRepo();
  try {
    const sha = repo.commit({ 'a.txt': 'one' });
    const result = churn(repo.dir, [`${sha}..HEAD`]);
    assert.deepEqual(result, {});
  } finally {
    repo.cleanup();
  }
});
