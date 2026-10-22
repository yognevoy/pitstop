import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_CONFIG, loadConfig } from '../../scripts/lib/config.js';

const SCHEMA = JSON.parse(readFileSync(new URL('../../schemas/config.schema.json', import.meta.url)));

function writeConfig(dir, config) {
  mkdirSync(join(dir, '.pitstop'), { recursive: true });
  writeFileSync(join(dir, '.pitstop/config.json'), JSON.stringify(config));
}

test('loadConfig: returns the defaults when there is no config.json', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pitstop-config-'));

  try {
    assert.deepEqual(loadConfig(dir, SCHEMA), DEFAULT_CONFIG);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadConfig: a partial override merges over the defaults, leaving the rest untouched', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pitstop-config-'));

  try {
    writeConfig(dir, { report_top_k: 3 });
    const config = loadConfig(dir, SCHEMA);

    assert.equal(config.report_top_k, 3);
    assert.equal(config.fallback_since, DEFAULT_CONFIG.fallback_since);
    assert.deepEqual(config.levels, DEFAULT_CONFIG.levels);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadConfig: overrides one level\'s max_files without touching the others', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pitstop-config-'));

  try {
    writeConfig(dir, { levels: { full: { max_files: 20 } } });
    const config = loadConfig(dir, SCHEMA);

    assert.equal(config.levels.full.max_files, 20);
    assert.equal(config.levels.quick.max_files, DEFAULT_CONFIG.levels.quick.max_files);
    assert.equal(config.levels.deep.max_files, DEFAULT_CONFIG.levels.deep.max_files);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadConfig: throws with the schema error when config.json is invalid', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pitstop-config-'));

  try {
    writeConfig(dir, { report_top_k: 'five' });
    assert.throws(() => loadConfig(dir, SCHEMA), /report_top_k/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
