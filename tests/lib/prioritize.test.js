import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prioritize } from '../../scripts/lib/prioritize.js';

function finding(file, severity, confidence) {
  return { anchors: [{ file, symbols: ['x'] }], severity, confidence };
}

test('prioritize: sorts must before should before nice', () => {
  const findings = [finding('a.js', 'nice', 0.5), finding('b.js', 'must', 0.5), finding('c.js', 'should', 0.5)];

  const result = prioritize(findings, 10);
  assert.deepEqual(result.map((f) => f.severity), ['must', 'should', 'nice']);
});

test('prioritize: breaks a severity tie by confidence descending', () => {
  const findings = [finding('a.js', 'should', 0.3), finding('b.js', 'should', 0.9)];

  const result = prioritize(findings, 10);
  assert.deepEqual(result.map((f) => f.anchors[0].file), ['b.js', 'a.js']);
});

test('prioritize: breaks a full tie by the first anchor file ascending', () => {
  const findings = [finding('z.js', 'should', 0.5), finding('a.js', 'should', 0.5)];

  const result = prioritize(findings, 10);
  assert.deepEqual(result.map((f) => f.anchors[0].file), ['a.js', 'z.js']);
});

test('prioritize: truncates to topK after sorting', () => {
  const findings = [finding('a.js', 'must', 0.5), finding('b.js', 'should', 0.5), finding('c.js', 'nice', 0.5)];

  const result = prioritize(findings, 2);
  assert.deepEqual(result.map((f) => f.anchors[0].file), ['a.js', 'b.js']);
});

test('prioritize: returns an empty array for empty findings', () => {
  assert.deepEqual(prioritize([], 10), []);
});

test('prioritize: does not mutate the input array', () => {
  const findings = [finding('b.js', 'nice', 0.5), finding('a.js', 'must', 0.5)];
  const original = [...findings];

  prioritize(findings, 10);
  assert.deepEqual(findings, original);
});
