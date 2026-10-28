import { test } from 'node:test';
import assert from 'node:assert/strict';
import { topTrends, trends } from '../../scripts/lib/trends.js';

function file(overrides = {}) {
  return { path: 'a.js', loc: 10, duplicate_lines: 0, open_findings: 0, ...overrides };
}

function snapshot(files) {
  return { files };
}

function record(history, overrides = {}) {
  return { status: 'open', history, ...overrides };
}

test('trends: first run (no history, no previous date) yields nothing', () => {
  assert.deepEqual(trends([snapshot([file()])], [], null), []);
});

test('trends: growth above the threshold between the last two snapshots is reported', () => {
  const history = [snapshot([file({ loc: 100 })]), snapshot([file({ loc: 140 })])];
  const result = trends(history, [], null, { growthThreshold: 0.3 });

  assert.deepEqual(result, [{ type: 'growth', path: 'a.js', metric: 'loc', from: 100, to: 140, growth: 0.4 }]);
});

test('trends: growth at or below the threshold is not reported', () => {
  const history = [snapshot([file({ loc: 100 })]), snapshot([file({ loc: 120 })])];
  assert.deepEqual(trends(history, [], null, { growthThreshold: 0.3 }), []);
});

test('trends: growth from 0 to a nonzero value is reported', () => {
  const history = [snapshot([file({ duplicate_lines: 0 })]), snapshot([file({ duplicate_lines: 6 })])];
  const result = trends(history, [], null);

  assert.equal(result.some((item) => item.metric === 'duplicate_lines' && item.growth === Infinity), true);
});

test('trends: a file missing from the previous snapshot is skipped, not treated as 0', () => {
  const history = [snapshot([file({ path: 'b.js', loc: 50 })]), snapshot([file({ path: 'a.js', loc: 50 })])];
  assert.deepEqual(trends(history, [], null), []);
});

test('trends: a metric that never decreases and strictly grew over the window is monotonic', () => {
  const history = [
    snapshot([file({ loc: 10 })]),
    snapshot([file({ loc: 12 })]),
    snapshot([file({ loc: 15 })]),
  ];
  const result = trends(history, [], null, { monotonicRuns: 3, growthThreshold: 1 });
  const monotonic = result.filter((item) => item.type === 'monotonic' && item.metric === 'loc');

  assert.equal(monotonic.length, 1);
  assert.deepEqual(monotonic[0].series, [10, 12, 15]);
});

test('trends: a monotonic series covers the file\'s whole history, not just the detection window', () => {
  const history = [
    snapshot([file({ loc: 1 })]),
    snapshot([file({ loc: 2 })]),
    snapshot([file({ loc: 10 })]),
    snapshot([file({ loc: 12 })]),
    snapshot([file({ loc: 15 })]),
  ];
  const result = trends(history, [], null, { monotonicRuns: 3, growthThreshold: 1 });
  const monotonic = result.filter((item) => item.type === 'monotonic' && item.metric === 'loc');

  assert.equal(monotonic.length, 1);
  assert.deepEqual(monotonic[0].series, [1, 2, 10, 12, 15]);
});

test('trends: a flat or decreasing series is not monotonic', () => {
  const history = [
    snapshot([file({ loc: 10 })]),
    snapshot([file({ loc: 10 })]),
    snapshot([file({ loc: 10 })]),
  ];
  const result = trends(history, [], null, { monotonicRuns: 3 });
  assert.deepEqual(result.filter((item) => item.type === 'monotonic'), []);
});

test('trends: fewer snapshots than monotonicRuns yields no monotonic trends', () => {
  const history = [snapshot([file({ loc: 10 })]), snapshot([file({ loc: 20 })])];
  const result = trends(history, [], null, { monotonicRuns: 3, growthThreshold: 100 });
  assert.deepEqual(result.filter((item) => item.type === 'monotonic'), []);
});

test('trends: burn-down counts opened/reopened vs. fixed/wontfix events after the previous run date', () => {
  const registry = [
    record([{ date: '2026-01-10', event: 'opened' }]),
    record([{ date: '2026-01-01', event: 'opened' }, { date: '2026-01-10', event: 'fixed' }], { status: 'fixed' }),
    record([{ date: '2026-01-01', event: 'opened' }], { status: 'open' }),
  ];
  const result = trends([snapshot([file()])], registry, '2026-01-05');

  const burnDown = result.find((item) => item.type === 'burn_down');
  assert.deepEqual(burnDown, { type: 'burn_down', opened: 1, closed: 1, open_total: 2 });
});

test('trends: burn-down ignores events at or before the previous run date', () => {
  const registry = [record([{ date: '2026-01-05', event: 'opened' }])];
  const result = trends([snapshot([file()])], registry, '2026-01-05');

  const burnDown = result.find((item) => item.type === 'burn_down');
  assert.deepEqual(burnDown, { type: 'burn_down', opened: 0, closed: 0, open_total: 1 });
});

test('trends: no burn-down entry without a previous run date', () => {
  const result = trends([snapshot([file()])], [record([{ date: '2026-01-05', event: 'opened' }])], null);
  assert.equal(result.some((item) => item.type === 'burn_down'), false);
});

test('topTrends: orders burn_down, then growth descending, then monotonic', () => {
  const items = [
    { type: 'growth', path: 'b.js', metric: 'loc', from: 10, to: 20, growth: 1 },
    { type: 'monotonic', path: 'c.js', metric: 'loc', series: [1, 2, 3] },
    { type: 'burn_down', opened: 2, closed: 1, open_total: 3 },
    { type: 'growth', path: 'a.js', metric: 'loc', from: 10, to: 30, growth: 2 },
  ];

  const result = topTrends(items, { maxCount: 4 });

  assert.deepEqual(result.map((item) => item.type + ':' + (item.path ?? '')), [
    'burn_down:',
    'growth:a.js',
    'growth:b.js',
    'monotonic:c.js',
  ]);
});

test('topTrends: caps at maxCount', () => {
  const items = [
    { type: 'growth', path: 'a.js', metric: 'loc', from: 10, to: 30, growth: 2 },
    { type: 'growth', path: 'b.js', metric: 'loc', from: 10, to: 20, growth: 1 },
    { type: 'monotonic', path: 'c.js', metric: 'loc', series: [1, 2, 3] },
  ];

  assert.equal(topTrends(items, { maxCount: 2 }).length, 2);
});

test('topTrends: drops a burn_down entry with no real change', () => {
  const items = [{ type: 'burn_down', opened: 0, closed: 0, open_total: 3 }];
  assert.deepEqual(topTrends(items), []);
});

test('topTrends: swaps the lowest-priority pick for a chart-bearing monotonic trend when none of the picks has one', () => {
  const items = [
    { type: 'growth', path: 'a.js', metric: 'loc', from: 10, to: 30, growth: 2 },
    { type: 'growth', path: 'b.js', metric: 'loc', from: 10, to: 20, growth: 1 },
    { type: 'monotonic', path: 'c.js', metric: 'loc', series: [1, 2, 3], chart: '../charts/c.png' },
  ];

  const result = topTrends(items, { maxCount: 2 });

  assert.deepEqual(result.map((item) => item.path), ['a.js', 'c.js']);
});

test('topTrends: does not swap when a pick already has a chart', () => {
  const items = [
    { type: 'growth', path: 'a.js', metric: 'loc', from: 10, to: 30, growth: 2 },
    { type: 'monotonic', path: 'b.js', metric: 'loc', series: [1, 2, 3], chart: '../charts/b.png' },
    { type: 'monotonic', path: 'c.js', metric: 'loc', series: [1, 2, 3], chart: '../charts/c.png' },
  ];

  const result = topTrends(items, { maxCount: 2 });

  assert.deepEqual(result.map((item) => item.path), ['a.js', 'b.js']);
});

test('topTrends: leaves the selection unchanged when no monotonic entry has a chart', () => {
  const items = [
    { type: 'growth', path: 'a.js', metric: 'loc', from: 10, to: 30, growth: 2 },
    { type: 'monotonic', path: 'b.js', metric: 'loc', series: [1, 2, 3] },
  ];

  const result = topTrends(items, { maxCount: 2 });

  assert.deepEqual(result.map((item) => item.path), ['a.js', 'b.js']);
});

test('topTrends: growth ties are broken by path', () => {
  const items = [
    { type: 'growth', path: 'z.js', metric: 'loc', from: 10, to: 20, growth: 1 },
    { type: 'growth', path: 'a.js', metric: 'loc', from: 10, to: 20, growth: 1 },
  ];

  assert.deepEqual(topTrends(items, { maxCount: 2 }).map((item) => item.path), ['a.js', 'z.js']);
});
