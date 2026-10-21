import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoped, setStatus, store } from '../../scripts/lib/registry.js';

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

test('store: a resurfacing wontfix finding stays wontfix, not a new open entry', () => {
  const opened = store([], [finding()], RUN_1);
  const dismissed = [{ ...opened[0], status: 'wontfix', status_reason: 'intentional' }];

  const result = store(dismissed, [finding()], RUN_2);

  assert.equal(result.length, 1);
  assert.equal(result[0].status, 'wontfix');
  assert.equal(result[0].seen_count, 2);
});

const isWontfix = (record) => record.status === 'wontfix';

test('scoped: groups a matching record under each of its in-scope anchor files', () => {
  const opened = store([], [finding()], RUN_1);
  const dismissed = [{ ...opened[0], status: 'wontfix', status_reason: 'intentional' }];

  const result = scoped(dismissed, isWontfix, ['services/billing/tax.ts', 'services/invoices/total.ts']);

  assert.deepEqual(result, {
    'services/billing/tax.ts': [{ id: dismissed[0].id, title: dismissed[0].title }],
    'services/invoices/total.ts': [{ id: dismissed[0].id, title: dismissed[0].title }],
  });
});

test('scoped: omits a matching record\'s anchor files that are not in scope', () => {
  const opened = store([], [finding()], RUN_1);
  const dismissed = [{ ...opened[0], status: 'wontfix', status_reason: 'intentional' }];

  const result = scoped(dismissed, isWontfix, ['unrelated.js']);

  assert.deepEqual(result, {});
});

test('scoped: omits a record the predicate rejects', () => {
  const opened = store([], [finding()], RUN_1);

  const result = scoped(opened, isWontfix, ['services/billing/tax.ts']);

  assert.deepEqual(result, {});
});

const TODAY = '2026-10-26';

test('setStatus: sets fixed with no reason needed', () => {
  const opened = store([], [finding()], RUN_1);

  const result = setStatus(opened, opened[0].id, 'fixed', { today: TODAY });

  assert.equal(result[0].status, 'fixed');
  assert.equal(result[0].status_reason, null);
  assert.equal(result[0].history.at(-1).event, 'fixed');
});

test('setStatus: wontfix requires a reason', () => {
  const opened = store([], [finding()], RUN_1);

  assert.throws(() => setStatus(opened, opened[0].id, 'wontfix', { today: TODAY }));
});

test('setStatus: wontfix with a reason sets status_reason', () => {
  const opened = store([], [finding()], RUN_1);

  const result = setStatus(opened, opened[0].id, 'wontfix', { reason: 'intentional', today: TODAY });

  assert.equal(result[0].status, 'wontfix');
  assert.equal(result[0].status_reason, 'intentional');
});

test('setStatus: moving away from wontfix clears status_reason', () => {
  const opened = store([], [finding()], RUN_1);
  const wontfixed = setStatus(opened, opened[0].id, 'wontfix', { reason: 'intentional', today: TODAY });

  const result = setStatus(wontfixed, wontfixed[0].id, 'open', { today: TODAY });

  assert.equal(result[0].status, 'open');
  assert.equal(result[0].status_reason, null);
});

test('setStatus: rejects an unknown status', () => {
  const opened = store([], [finding()], RUN_1);

  assert.throws(() => setStatus(opened, opened[0].id, 'bogus', { today: TODAY }));
});

test('setStatus: rejects an unknown id', () => {
  const opened = store([], [finding()], RUN_1);

  assert.throws(() => setStatus(opened, 'f_doesnotexist', 'fixed', { today: TODAY }));
});

test('setStatus: does not mutate its input records', () => {
  const opened = store([], [finding()], RUN_1);
  const snapshot = JSON.parse(JSON.stringify(opened));

  setStatus(opened, opened[0].id, 'fixed', { today: TODAY });

  assert.deepEqual(opened, snapshot);
});
