import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { validate } from '../scripts/validate.js';
import { createFixtureRepo } from './helpers/fixture-repo.js';

const schema = JSON.parse(readFileSync(new URL('../schemas/finding.schema.json', import.meta.url)));

function validFinding(overrides = {}) {
  return {
    category: 'duplication',
    severity: 'should',
    agent: 'simplifier',
    title: 'VAT calculation is duplicated',
    anchors: [{ file: 'tax.js', symbols: ['calcVat'] }],
    source: [{ file: 'tax.js', line: 1, snippet: 'function calcVat() {}' }],
    what: 'what',
    problem: 'problem',
    fix: 'fix',
    if_skipped: 'if skipped',
    effort: 'S',
    confidence: 0.8,
    ...overrides,
  };
}

function writeRaw(dir, agent, findings) {
  const rawDir = join(dir, '.pitstop/run/raw');
  mkdirSync(rawDir, { recursive: true });
  writeFileSync(join(rawDir, `${agent}.json`), JSON.stringify(findings));
}

test('validate: returns no findings when there is no raw directory', () => {
  const repo = createFixtureRepo();

  try {
    assert.deepEqual(validate(repo.dir, schema), { valid: [], rejected: [] });
  } finally {
    repo.cleanup();
  }
});

test('validate: accepts a finding whose anchor file and symbol both exist', () => {
  const repo = createFixtureRepo();

  try {
    writeFileSync(join(repo.dir, 'tax.js'), 'function calcVat() {}\n');
    writeRaw(repo.dir, 'simplifier', [validFinding()]);

    const result = validate(repo.dir, schema);
    assert.equal(result.valid.length, 1);
    assert.deepEqual(result.rejected, []);
  } finally {
    repo.cleanup();
  }
});

test('validate: rejects a schema-invalid finding with the schema error as the reason', () => {
  const repo = createFixtureRepo();

  try {
    writeFileSync(join(repo.dir, 'tax.js'), 'function calcVat() {}\n');
    const finding = validFinding({ severity: 'urgent' });
    writeRaw(repo.dir, 'simplifier', [finding]);

    const result = validate(repo.dir, schema);
    assert.deepEqual(result.valid, []);
    assert.equal(result.rejected.length, 1);
    assert.equal(result.rejected[0].agent, 'simplifier');
    assert.match(result.rejected[0].reasons[0], /\$\.severity/);
  } finally {
    repo.cleanup();
  }
});

test('validate: rejects a finding whose anchor file does not exist', () => {
  const repo = createFixtureRepo();

  try {
    writeRaw(repo.dir, 'simplifier', [validFinding()]);

    const result = validate(repo.dir, schema);
    assert.deepEqual(result.valid, []);
    assert.match(result.rejected[0].reasons[0], /anchor file "tax\.js" does not exist/);
  } finally {
    repo.cleanup();
  }
});

test('validate: rejects a finding whose anchor symbol does not occur in the file', () => {
  const repo = createFixtureRepo();

  try {
    writeFileSync(join(repo.dir, 'tax.js'), 'function somethingElse() {}\n');
    writeRaw(repo.dir, 'simplifier', [validFinding()]);

    const result = validate(repo.dir, schema);
    assert.deepEqual(result.valid, []);
    assert.match(result.rejected[0].reasons[0], /no symbol in \["calcVat"\] found in "tax\.js"/);
  } finally {
    repo.cleanup();
  }
});

test('validate: rejects the whole file with a reason when it is not valid JSON', () => {
  const repo = createFixtureRepo();

  try {
    const rawDir = join(repo.dir, '.pitstop/run/raw');
    mkdirSync(rawDir, { recursive: true });
    writeFileSync(join(rawDir, 'simplifier.json'), 'not json');

    const result = validate(repo.dir, schema);
    assert.deepEqual(result.valid, []);
    assert.equal(result.rejected.length, 1);
    assert.equal(result.rejected[0].agent, 'simplifier');
    assert.match(result.rejected[0].reasons[0], /invalid JSON/);
  } finally {
    repo.cleanup();
  }
});

test('validate: rejects the whole file with a reason when it is not a JSON array', () => {
  const repo = createFixtureRepo();

  try {
    writeRaw(repo.dir, 'simplifier', { not: 'an array' });

    const result = validate(repo.dir, schema);
    assert.deepEqual(result.valid, []);
    assert.match(result.rejected[0].reasons[0], /expected a JSON array/);
  } finally {
    repo.cleanup();
  }
});

test('validate: processes every agent file in the raw directory', () => {
  const repo = createFixtureRepo();

  try {
    writeFileSync(join(repo.dir, 'tax.js'), 'function calcVat() {}\n');
    writeRaw(repo.dir, 'simplifier', [validFinding()]);
    writeRaw(repo.dir, 'reviewer', [validFinding({ agent: 'reviewer' })]);

    const result = validate(repo.dir, schema);
    assert.equal(result.valid.length, 2);
  } finally {
    repo.cleanup();
  }
});
