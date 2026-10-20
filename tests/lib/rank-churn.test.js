import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankChurn } from '../../scripts/lib/rank-churn.js';

test('rankChurn: sorts by commits descending first', () => {
  const churn = {
    'a.js': { commits: 1, added: 100, deleted: 100 },
    'b.js': { commits: 3, added: 1, deleted: 1 },
    'c.js': { commits: 2, added: 1, deleted: 1 },
  };

  const result = rankChurn(churn, 10);
  assert.deepEqual(result.map((f) => f.path), ['b.js', 'c.js', 'a.js']);
});

test('rankChurn: breaks a commits tie by total changed lines descending', () => {
  const churn = {
    'small.js': { commits: 2, added: 1, deleted: 1 },
    'big.js': { commits: 2, added: 10, deleted: 5 },
  };

  const result = rankChurn(churn, 10);
  assert.deepEqual(result.map((f) => f.path), ['big.js', 'small.js']);
});

test('rankChurn: breaks a full tie by path ascending for determinism', () => {
  const churn = {
    'z.js': { commits: 1, added: 1, deleted: 0 },
    'a.js': { commits: 1, added: 1, deleted: 0 },
  };

  const result = rankChurn(churn, 10);
  assert.deepEqual(result.map((f) => f.path), ['a.js', 'z.js']);
});

test('rankChurn: truncates to maxFiles after sorting', () => {
  const churn = {
    'a.js': { commits: 1, added: 0, deleted: 0 },
    'b.js': { commits: 2, added: 0, deleted: 0 },
    'c.js': { commits: 3, added: 0, deleted: 0 },
  };

  const result = rankChurn(churn, 2);
  assert.deepEqual(result.map((f) => f.path), ['c.js', 'b.js']);
});

test('rankChurn: returns an empty array for empty churn', () => {
  assert.deepEqual(rankChurn({}, 10), []);
});
