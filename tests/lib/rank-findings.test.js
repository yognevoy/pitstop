import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankFindings } from '../../scripts/lib/rank-findings.js';

function finding(file, scoreValue) {
  return { anchors: [{ file, symbols: ['x'] }], score: scoreValue };
}

test('rankFindings: sorts by score descending', () => {
  const findings = [finding('a.js', 1), finding('b.js', 3), finding('c.js', 2)];

  const result = rankFindings(findings, 10);
  assert.deepEqual(result.map((f) => f.anchors[0].file), ['b.js', 'c.js', 'a.js']);
});

test('rankFindings: breaks a score tie by the first anchor file ascending', () => {
  const findings = [finding('z.js', 1), finding('a.js', 1)];

  const result = rankFindings(findings, 10);
  assert.deepEqual(result.map((f) => f.anchors[0].file), ['a.js', 'z.js']);
});

test('rankFindings: truncates to topK after sorting', () => {
  const findings = [finding('a.js', 3), finding('b.js', 2), finding('c.js', 1)];

  const result = rankFindings(findings, 2);
  assert.deepEqual(result.map((f) => f.anchors[0].file), ['a.js', 'b.js']);
});

test('rankFindings: returns an empty array for empty findings', () => {
  assert.deepEqual(rankFindings([], 10), []);
});

test('rankFindings: does not mutate the input array', () => {
  const findings = [finding('b.js', 1), finding('a.js', 3)];
  const original = [...findings];

  rankFindings(findings, 10);
  assert.deepEqual(findings, original);
});
