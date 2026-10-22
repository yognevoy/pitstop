import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cluster } from '../../scripts/lib/cluster.js';

function finding(title, file, symbols) {
  return { title, anchors: [{ file, symbols }] };
}

test('cluster: returns one empty result for no findings', () => {
  assert.deepEqual(cluster([]), []);
});

test('cluster: unrelated findings each get their own cluster', () => {
  const a = finding('A', 'a.js', ['f']);
  const b = finding('B', 'b.js', ['g']);

  const result = cluster([a, b]);

  assert.deepEqual(result, [[a], [b]]);
});

test('cluster: findings sharing an anchor file are grouped together', () => {
  const a = finding('A', 'a.js', ['f']);
  const b = finding('B', 'a.js', ['g']);

  const result = cluster([a, b]);

  assert.equal(result.length, 1);
  assert.equal(result[0].length, 2);
});

test('cluster: findings sharing a symbol in different files are grouped together', () => {
  const a = finding('A', 'a.js', ['calcVat']);
  const b = finding('B', 'b.js', ['calcVat']);

  const result = cluster([a, b]);

  assert.equal(result.length, 1);
  assert.equal(result[0].length, 2);
});

test('cluster: overlap is transitive across three findings', () => {
  const a = finding('A', 'a.js', ['f']);
  const b = finding('B', 'b.js', ['f']); // shares symbol f with a
  const c = finding('C', 'c.js', ['g']); // shares no anchor with a, but...
  b.anchors.push({ file: 'c.js', symbols: ['g'] }); // b also touches c.js, linking to c

  const result = cluster([a, b, c]);

  assert.equal(result.length, 1);
  assert.equal(result[0].length, 3);
});

test('cluster: output order is deterministic regardless of input order', () => {
  const a = finding('A', 'a.js', ['f']);
  const z = finding('Z', 'z.js', ['g']);

  const forward = cluster([a, z]);
  const backward = cluster([z, a]);

  assert.deepEqual(forward, backward);
  assert.deepEqual(forward, [[a], [z]]);
});

test('cluster: within a cluster, members are ordered by file then title', () => {
  const b = finding('B second', 'a.js', ['f']);
  const a = finding('A first', 'a.js', ['f']);

  const result = cluster([b, a]);

  assert.deepEqual(result, [[a, b]]);
});
