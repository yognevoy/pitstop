import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  matchesPattern,
  isIgnored,
  parsePitstopIgnore,
  existsAtHead,
  filterScope,
  BUILTIN_IGNORE,
} from '../../scripts/lib/ignore.js';
import { createFixtureRepo } from '../helpers/fixture-repo.js';

const IDENTITY_ENV = {
  GIT_AUTHOR_NAME: 'Fixture',
  GIT_AUTHOR_EMAIL: 'fixture@example.com',
  GIT_AUTHOR_DATE: '2024-03-01T00:00:00Z',
  GIT_COMMITTER_NAME: 'Fixture',
  GIT_COMMITTER_EMAIL: 'fixture@example.com',
  GIT_COMMITTER_DATE: '2024-03-01T00:00:00Z',
};

test('matchesPattern: directory pattern matches at any depth', () => {
  assert.equal(matchesPattern('node_modules/foo.js', 'node_modules/'), true);
  assert.equal(matchesPattern('src/node_modules/foo.js', 'node_modules/'), true);
  assert.equal(matchesPattern('src/my_node_modules/foo.js', 'node_modules/'), false);
});

test('matchesPattern: no-slash glob matches the basename at any depth', () => {
  assert.equal(matchesPattern('a.min.js', '*.min.js'), true);
  assert.equal(matchesPattern('dist/a.min.js', '*.min.js'), true);
  assert.equal(matchesPattern('a.min.jsx', '*.min.js'), false);
});

test('matchesPattern: a pattern containing "/" is anchored to the root', () => {
  assert.equal(matchesPattern('src/generated/a.js', 'src/generated/'), true);
  assert.equal(matchesPattern('lib/src/generated/a.js', 'src/generated/'), false);
});

test('matchesPattern: blank lines and comments never match', () => {
  assert.equal(matchesPattern('a.txt', ''), false);
  assert.equal(matchesPattern('a.txt', '# comment'), false);
});

test('isIgnored: true if any pattern in the list matches', () => {
  assert.equal(isIgnored('package-lock.json', BUILTIN_IGNORE), true);
  assert.equal(isIgnored('src/index.js', BUILTIN_IGNORE), false);
});

test('parsePitstopIgnore: strips comments and blank lines', () => {
  const content = '# comment\n\nsrc/generated/\n  *.secret  \n';
  assert.deepEqual(parsePitstopIgnore(content), ['src/generated/', '*.secret']);
});

test('existsAtHead: false for a file removed in a later commit', () => {
  const repo = createFixtureRepo();
  try {
    repo.commit({ 'a.txt': 'one', 'b.txt': 'two' });
    repo.run(['rm', '-q', 'a.txt']);
    repo.run(['commit', '-q', '-m', 'remove a.txt'], IDENTITY_ENV);

    assert.equal(existsAtHead(repo.dir, 'a.txt'), false);
    assert.equal(existsAtHead(repo.dir, 'b.txt'), true);
  } finally {
    repo.cleanup();
  }
});

test('filterScope: drops deleted, built-in-ignored, and extra-pattern-ignored files', () => {
  const repo = createFixtureRepo();
  try {
    repo.commit({
      'kept.js': 'x',
      'package-lock.json': 'x',
      'secrets/token.txt': 'x',
      'deleted.txt': 'x',
    });
    repo.run(['rm', '-q', 'deleted.txt']);
    repo.run(['commit', '-q', '-m', 'remove deleted.txt'], IDENTITY_ENV);

    const candidates = ['kept.js', 'package-lock.json', 'secrets/token.txt', 'deleted.txt'];
    const result = filterScope(repo.dir, candidates, ['secrets/']);

    assert.deepEqual(result, ['kept.js']);
  } finally {
    repo.cleanup();
  }
});
