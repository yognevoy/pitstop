import { test } from 'node:test';
import assert from 'node:assert/strict';
import { metrics } from '../../scripts/lib/metrics.js';
import { createFixtureRepo } from '../helpers/fixture-repo.js';

function scopeFile(overrides = {}) {
  return { path: 'a.js', commits: 2, added: 5, deleted: 1, ...overrides };
}

function openFinding(file, overrides = {}) {
  return { status: 'open', anchors: [{ file, symbols: ['f'] }], ...overrides };
}

test('metrics: reports lines of code at HEAD alongside the file\'s churn', () => {
  const repo = createFixtureRepo();
  try {
    repo.commit({ 'a.js': 'l1\nl2\nl3\n' });

    const result = metrics(repo.dir, [scopeFile()], []);
    assert.deepEqual(result, [
      { path: 'a.js', loc: 3, commits: 2, added: 5, deleted: 1, duplicate_lines: 0, open_findings: 0 },
    ]);
  } finally {
    repo.cleanup();
  }
});

test('metrics: counts open registry findings anchored to the file, ignoring non-open ones', () => {
  const repo = createFixtureRepo();
  try {
    repo.commit({ 'a.js': 'l1\n' });

    const registry = [
      openFinding('a.js'),
      openFinding('a.js'),
      openFinding('a.js', { status: 'fixed' }),
      openFinding('b.js'),
    ];
    const result = metrics(repo.dir, [scopeFile()], registry);

    assert.equal(result[0].open_findings, 2);
  } finally {
    repo.cleanup();
  }
});

test('metrics: carries over the duplicate line count passed in for the file', () => {
  const repo = createFixtureRepo();
  try {
    repo.commit({ 'a.js': 'l1\n' });

    const result = metrics(repo.dir, [scopeFile()], [], { 'a.js': 4 });
    assert.equal(result[0].duplicate_lines, 4);
  } finally {
    repo.cleanup();
  }
});

test('metrics: a file with no trailing newline still counts its last line', () => {
  const repo = createFixtureRepo();
  try {
    repo.commit({ 'a.js': 'l1\nl2' });

    const result = metrics(repo.dir, [scopeFile()], []);
    assert.equal(result[0].loc, 2);
  } finally {
    repo.cleanup();
  }
});

test('metrics: an empty file has 0 lines of code', () => {
  const repo = createFixtureRepo();
  try {
    repo.commit({ 'a.js': '' });

    const result = metrics(repo.dir, [scopeFile()], []);
    assert.equal(result[0].loc, 0);
  } finally {
    repo.cleanup();
  }
});
