import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordId } from '../../scripts/lib/registry.js';
import { score } from '../../scripts/lib/score.js';

const WEIGHTS = {
  severity: { must: 3, should: 2, nice: 1 },
  effort: { S: 1, M: 1.5, L: 2.5 },
  recurring_bonus: 1.5,
};

function finding(overrides = {}) {
  return {
    category: 'duplication',
    severity: 'should',
    anchors: [{ file: 'a.js', symbols: ['f'] }],
    confidence: 0.8,
    effort: 'S',
    ...overrides,
  };
}

test('score: computes severity * hotspot * confidence / effort with no recurring bonus for a new finding', () => {
  const scopeFiles = [{ path: 'a.js', commits: 10 }];
  const result = score([finding()], scopeFiles, [], WEIGHTS);

  // hotspot(a.js) = 10 / 10 = 1
  const expected = (2 * 1 * 0.8) / 1;
  assert.equal(result[0].score, expected);
  assert.deepEqual(result[0].score_detail, { severity_weight: 2, hotspot: 1, effort_weight: 1, recurring_bonus: 1 });
});

test('score: hotspot normalizes a file\'s commits against the busiest file in scope', () => {
  const scopeFiles = [
    { path: 'a.js', commits: 2 },
    { path: 'b.js', commits: 10 },
  ];
  const result = score([finding({ anchors: [{ file: 'a.js', symbols: ['f'] }] })], scopeFiles, [], WEIGHTS);

  assert.equal(result[0].score_detail.hotspot, 0.2);
});

test('score: a multi-file finding takes the max hotspot across its anchors', () => {
  const scopeFiles = [
    { path: 'a.js', commits: 2 },
    { path: 'b.js', commits: 10 },
  ];
  const multiFile = finding({
    anchors: [
      { file: 'a.js', symbols: ['f'] },
      { file: 'b.js', symbols: ['g'] },
    ],
  });
  const result = score([multiFile], scopeFiles, [], WEIGHTS);

  assert.equal(result[0].score_detail.hotspot, 1);
});

test('score: applies the recurring bonus once an existing record has been seen 3+ times', () => {
  const scopeFiles = [{ path: 'a.js', commits: 10 }];
  const f = finding();
  const id = recordId(f.category, f.anchors);
  const registry = [{ id, seen_count: 3 }];

  const result = score([f], scopeFiles, registry, WEIGHTS);

  assert.equal(result[0].score_detail.recurring_bonus, 1.5);
  assert.equal(result[0].score, (2 * 1 * 0.8 / 1) * 1.5);
});

test('score: does not apply the recurring bonus below 3 prior sightings', () => {
  const scopeFiles = [{ path: 'a.js', commits: 10 }];
  const f = finding();
  const id = recordId(f.category, f.anchors);
  const registry = [{ id, seen_count: 2 }];

  const result = score([f], scopeFiles, registry, WEIGHTS);

  assert.equal(result[0].score_detail.recurring_bonus, 1);
});

test('score: uses the severity and effort weights from config', () => {
  const scopeFiles = [{ path: 'a.js', commits: 10 }];
  const result = score([finding({ severity: 'must', effort: 'L' })], scopeFiles, [], WEIGHTS);

  assert.equal(result[0].score_detail.severity_weight, 3);
  assert.equal(result[0].score_detail.effort_weight, 2.5);
});

test('score: leaves the original finding fields untouched', () => {
  const scopeFiles = [{ path: 'a.js', commits: 10 }];
  const f = finding({ title: 'Something duplicated' });
  const result = score([f], scopeFiles, [], WEIGHTS);

  assert.equal(result[0].title, 'Something duplicated');
  assert.equal(result[0].category, 'duplication');
});
