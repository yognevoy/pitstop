import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sparkline } from '../../scripts/lib/sparkline.js';

test('sparkline: empty input yields an empty string', () => {
  assert.equal(sparkline([]), '');
});

test('sparkline: one char per value, same length as input', () => {
  assert.equal(sparkline([1, 2, 3]).length, 3);
});

test('sparkline: lowest value maps to the lowest block, highest to the highest', () => {
  const result = sparkline([1, 5, 10]);
  assert.equal(result[0], '▁');
  assert.equal(result[2], '█');
});

test('sparkline: a flat series renders the same middle block for every value', () => {
  const result = sparkline([4, 4, 4]);
  assert.equal(result, '▄▄▄');
});

test('sparkline: is monotonic for a monotonic input series', () => {
  const blocks = '▁▂▃▄▅▆▇█';
  const result = sparkline([1, 2, 3, 4, 5]);
  const indices = [...result].map((char) => blocks.indexOf(char));

  for (let i = 1; i < indices.length; i++) {
    assert.ok(indices[i] >= indices[i - 1]);
  }
});
