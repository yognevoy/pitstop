import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { report } from '../../scripts/lib/report.js';

const template = readFileSync(new URL('../../templates/report.md', import.meta.url), 'utf8');

function scope(overrides = {}) {
  return {
    level: 'full',
    base: { method: 'last_run', base: 'a3f9e1c', since: null, reason: 'last run commit a3f9e1c is an ancestor of HEAD' },
    generated_at: '2026-10-19T10:00:00Z',
    files: [{ path: 'a.js', commits: 1, added: 1, deleted: 0 }],
    ...overrides,
  };
}

function finding(overrides = {}) {
  return {
    category: 'duplication',
    severity: 'should',
    title: 'VAT calculation is duplicated',
    anchors: [{ file: 'tax.js', symbols: ['calcVat'] }],
    what: 'VAT is computed inline in two places.',
    problem: 'A rate change has to be made twice.',
    fix: 'Extract a shared calcVat(price) helper.',
    if_skipped: 'The two copies can drift out of sync.',
    effort: 'S',
    confidence: 0.8,
    score: 1.6,
    ...overrides,
  };
}

test('report: fills in the header from scope metadata', () => {
  const text = report(template, scope(), [], 5);

  assert.match(text, /# Pitstop report — 2026-10-19/);
  assert.match(text, /\*\*1 files\*\* since a3f9e1c\.\.HEAD \(last run commit a3f9e1c is an ancestor of HEAD\)/);
});

test('report: describes the period as a since range on a fallback base', () => {
  const fallback = scope({ base: { method: 'fallback', base: null, since: '4 weeks ago', reason: 'no previous run recorded' } });
  const text = report(template, fallback, [], 5);

  assert.match(text, /since 4 weeks ago → HEAD \(no previous run recorded\)/);
});

test('report: summarizes the finding count and severity breakdown', () => {
  const findings = [finding({ severity: 'must' }), finding({ severity: 'should' }), finding({ severity: 'should' })];
  const text = report(template, scope(), findings, 5);

  assert.match(text, /\*\*3 findings\*\* \(1 must, 2 should\)/);
});

test('report: omits a severity with zero findings from the breakdown', () => {
  const findings = [finding({ severity: 'should' })];
  const text = report(template, scope(), findings, 5);

  assert.match(text, /\*\*1 finding\*\* \(1 should\)/);
  assert.doesNotMatch(text, /must|nice/);
});

test('report: groups findings under a Must fix / Should fix / Nice to have heading', () => {
  const findings = [finding({ title: 'A must', severity: 'must' }), finding({ title: 'A nice', severity: 'nice' })];
  const text = report(template, scope(), findings, 5);

  assert.match(text, /## Must fix\n\n### 1\. A must/);
  assert.match(text, /## Nice to have\n\n### 2\. A nice/);
  assert.doesNotMatch(text, /## Should fix/);
});

test('report: numbers findings continuously across severity groups, in severity order', () => {
  const findings = [
    finding({ title: 'A should', severity: 'should' }),
    finding({ title: 'A must', severity: 'must' }),
  ];
  const text = report(template, scope(), findings, 5);

  assert.match(text, /### 1\. A must/);
  assert.match(text, /### 2\. A should/);
});

test('report: renders each top finding with its what/problem/fix/if_skipped', () => {
  const text = report(template, scope(), [finding()], 5);

  assert.match(text, /### 1\. VAT calculation is duplicated/);
  assert.match(text, /\*duplication · should · effort S\*/);
  assert.match(text, /\*\*What:\*\* VAT is computed inline in two places\./);
  assert.match(text, /\*\*Problem:\*\* A rate change has to be made twice\./);
  assert.match(text, /\*\*Fix:\*\* Extract a shared calcVat\(price\) helper\./);
  assert.match(text, /\*\*If skipped:\*\* The two copies can drift out of sync\./);
});

test('report: says so when there are no findings', () => {
  const text = report(template, scope(), [], 5);
  assert.match(text, /No findings this run\./);
});

test('report: only shows the top K findings and reports the rest as cut, pluralized', () => {
  const findings = [
    finding({ title: 'A', score: 3 }),
    finding({ title: 'B', score: 2 }),
    finding({ title: 'C', score: 1 }),
  ];

  const text = report(template, scope(), findings, 1);

  assert.match(text, /A$/m);
  assert.doesNotMatch(text, /\bB\b/);
  assert.doesNotMatch(text, /\bC\b/);
  assert.match(text, /2 more findings below the cut\./);
});

test('report: uses singular wording for exactly one finding below the cut', () => {
  const findings = [finding({ title: 'A', score: 2 }), finding({ title: 'B', score: 1 })];
  const text = report(template, scope(), findings, 1);

  assert.match(text, /1 more finding below the cut\./);
});

test('report: omits the cut line entirely when nothing was cut', () => {
  const text = report(template, scope(), [finding()], 5);
  assert.doesNotMatch(text, /below the cut/);
});
