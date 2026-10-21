import { test } from 'node:test';
import assert from 'node:assert/strict';
import { store } from '../../scripts/lib/registry.js';

const RUN_1 = { date: '2026-10-19T10:00:00Z', sha: 'a3f9e1c' };
const RUN_2 = { date: '2026-10-26T10:00:00Z', sha: 'b7c2d4e' };

function finding(overrides = {}) {
  return {
    category: 'duplication',
    severity: 'should',
    agent: 'simplifier',
    title: 'VAT calculation is duplicated in billing and invoices',
    anchors: [
      { file: 'services/billing/tax.ts', symbols: ['calcVat'] },
      { file: 'services/invoices/total.ts', symbols: ['vatFor'] },
    ],
    source: [{ file: 'services/invoices/total.ts', line: 42, snippet: 'return baseAmount * VAT_RATE;' }],
    what: 'VAT is computed twice.',
    problem: 'The two implementations can drift apart.',
    fix: 'Extract one shared calcVat() helper.',
    if_skipped: 'Future tax changes land in only one place.',
    effort: 'S',
    confidence: 0.8,
    ...overrides,
  };
}

test('store: a brand-new finding becomes an open record', () => {
  const result = store([], [finding()], RUN_1);

  assert.equal(result.length, 1);
  assert.match(result[0].id, /^f_[0-9a-f]{8}$/);
  assert.equal(result[0].status, 'open');
  assert.equal(result[0].status_reason, null);
  assert.equal(result[0].deferred_until, null);
  assert.deepEqual(result[0].first_seen, RUN_1);
  assert.deepEqual(result[0].last_seen, RUN_1);
  assert.equal(result[0].seen_count, 1);
  assert.deepEqual(result[0].history, [{ date: RUN_1.date, event: 'opened' }]);
});

test('store: a returning finding updates last_seen, seen_count and history only', () => {
  const opened = store([], [finding()], RUN_1);

  const repeated = finding({ title: 'Reworded title, same problem', confidence: 0.6 });
  const result = store(opened, [repeated], RUN_2);

  assert.equal(result.length, 1);
  assert.equal(result[0].id, opened[0].id);
  assert.deepEqual(result[0].first_seen, RUN_1);
  assert.deepEqual(result[0].last_seen, RUN_2);
  assert.equal(result[0].seen_count, 2);
  assert.deepEqual(result[0].history, [
    { date: RUN_1.date, event: 'opened' },
    { date: RUN_2.date, event: 'seen' },
  ]);
  assert.equal(result[0].title, 'VAT calculation is duplicated in billing and invoices');
  assert.equal(result[0].confidence, 0.8);
});

test('store: a different symbol list for the same files still matches', () => {
  const opened = store(
    [],
    [finding({ anchors: [{ file: 'services/billing/tax.ts', symbols: ['calcVat', 'TAX_RATE'] }] })],
    RUN_1,
  );

  const result = store(
    opened,
    [finding({ anchors: [{ file: 'services/billing/tax.ts', symbols: ['formatTax'] }] })],
    RUN_2,
  );

  assert.equal(result.length, 1);
  assert.equal(result[0].seen_count, 2);
});

test('store: two findings sharing category and files collapse into one record', () => {
  const result = store(
    [],
    [
      finding({ anchors: [{ file: 'services/billing/tax.ts', symbols: ['calcVat'] }] }),
      finding({ anchors: [{ file: 'services/billing/tax.ts', symbols: ['formatTax'] }] }),
    ],
    RUN_1,
  );

  assert.equal(result.length, 1);
  assert.equal(result[0].seen_count, 2);
});

test('store: a different category keeps findings separate', () => {
  const result = store(
    [],
    [finding({ category: 'duplication' }), finding({ category: 'overcomplexity' })],
    RUN_1,
  );

  assert.equal(result.length, 2);
  assert.notEqual(result[0].id, result[1].id);
});

test('store: a different file set keeps findings separate', () => {
  const result = store(
    [],
    [
      finding({ anchors: [{ file: 'a.js', symbols: ['f'] }] }),
      finding({ anchors: [{ file: 'b.js', symbols: ['f'] }] }),
    ],
    RUN_1,
  );

  assert.equal(result.length, 2);
  assert.notEqual(result[0].id, result[1].id);
});

test('store: an existing record matched by nothing this run passes through unchanged', () => {
  const opened = store([], [finding()], RUN_1);

  const result = store(opened, [], RUN_2);

  assert.deepEqual(result, opened);
});

test('store: does not mutate the existing records passed in', () => {
  const opened = store([], [finding()], RUN_1);
  const snapshot = JSON.parse(JSON.stringify(opened));

  store(opened, [finding()], RUN_2);

  assert.deepEqual(opened, snapshot);
});
