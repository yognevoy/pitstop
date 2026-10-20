import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validate } from '../../scripts/lib/schema.js';

const findingSchema = JSON.parse(readFileSync(new URL('../../schemas/finding.schema.json', import.meta.url)));

function validFinding() {
  return {
    category: 'duplication',
    severity: 'should',
    agent: 'simplifier',
    title: 'VAT calculation is duplicated in billing and invoices',
    anchors: [{ file: 'services/billing/tax.js', symbols: ['calcVat'] }],
    source: [{ file: 'services/billing/tax.js', line: 42, snippet: 'const vat = ...' }],
    what: 'what',
    problem: 'problem',
    fix: 'fix',
    if_skipped: 'if skipped',
    effort: 'S',
    confidence: 0.8,
  };
}

test('validate: accepts a well-formed finding', () => {
  assert.deepEqual(validate(findingSchema, validFinding()), []);
});

test('validate: reports a missing required property', () => {
  const finding = validFinding();
  delete finding.title;

  const errors = validate(findingSchema, finding);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /\$\.title: missing required property/);
});

test('validate: reports a value outside an enum', () => {
  const finding = validFinding();
  finding.severity = 'urgent';

  const errors = validate(findingSchema, finding);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /\$\.severity/);
});

test('validate: reports a wrong type', () => {
  const finding = validFinding();
  finding.confidence = 'high';

  const errors = validate(findingSchema, finding);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /\$\.confidence: expected type number, got string/);
});

test('validate: enforces minItems on anchors', () => {
  const finding = validFinding();
  finding.anchors = [];

  const errors = validate(findingSchema, finding);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /\$\.anchors: has 0 items, fewer than minItems 1/);
});

test('validate: enforces minItems on a nested anchor\'s symbols', () => {
  const finding = validFinding();
  finding.anchors = [{ file: 'a.js', symbols: [] }];

  const errors = validate(findingSchema, finding);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /\$\.anchors\[0\]\.symbols: has 0 items, fewer than minItems 1/);
});

test('validate: enforces the confidence range', () => {
  const finding = validFinding();
  finding.confidence = 1.5;

  const errors = validate(findingSchema, finding);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /\$\.confidence: 1\.5 is above maximum 1/);
});

test('validate: collects multiple errors at once', () => {
  const finding = validFinding();
  delete finding.title;
  finding.effort = 'XL';

  const errors = validate(findingSchema, finding);
  assert.equal(errors.length, 2);
});
