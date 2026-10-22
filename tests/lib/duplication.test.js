import { test } from 'node:test';
import assert from 'node:assert/strict';
import { duplicateLineCounts } from '../../scripts/lib/duplication.js';

test('duplicateLineCounts: a window repeated within one file counts both occurrences', () => {
  const lines = ['a', 'b', 'c', 'd', 'e', 'f', 'x', 'a', 'b', 'c', 'd', 'e', 'f'];
  const counts = duplicateLineCounts({ 'a.js': lines }, 6);

  assert.equal(counts['a.js'], 12);
});

test('duplicateLineCounts: a window shared across two files counts in both', () => {
  const shared = ['a', 'b', 'c', 'd', 'e', 'f'];
  const counts = duplicateLineCounts({ 'a.js': shared, 'b.js': shared }, 6);

  assert.equal(counts['a.js'], 6);
  assert.equal(counts['b.js'], 6);
});

test('duplicateLineCounts: no file gets a nonzero count when nothing repeats', () => {
  const counts = duplicateLineCounts(
    { 'a.js': ['a', 'b', 'c', 'd', 'e', 'f'], 'b.js': ['g', 'h', 'i', 'j', 'k', 'l'] },
    6,
  );

  assert.equal(counts['a.js'], 0);
  assert.equal(counts['b.js'], 0);
});

test('duplicateLineCounts: a window of only blank (normalized) lines is never counted as a duplicate', () => {
  const counts = duplicateLineCounts({ 'a.js': ['', '', '', '', '', '', '', '', '', '', '', ''] }, 6);
  assert.equal(counts['a.js'], 0);
});

test('duplicateLineCounts: a file shorter than the window has no windows at all', () => {
  const counts = duplicateLineCounts({ 'a.js': ['a', 'b', 'c'] }, 6);
  assert.equal(counts['a.js'], 0);
});

test('duplicateLineCounts: defaults to a 6-line window', () => {
  const shared = ['a', 'b', 'c', 'd', 'e', 'f'];
  const counts = duplicateLineCounts({ 'a.js': shared, 'b.js': shared });

  assert.equal(counts['a.js'], 6);
});
