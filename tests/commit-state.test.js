import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { commitState } from '../scripts/commit-state.js';

function params(overrides = {}) {
  return {
    report: '# Pitstop report\n',
    sha: 'a3f9e1c',
    level: 'full',
    generatedAt: '2026-10-19T10:00:00Z',
    pluginVersion: '0.1.0',
    ...overrides,
  };
}

test('commitState: writes the report under .pitstop/reports/<date>.md', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pitstop-commit-'));

  try {
    const { reportPath } = commitState(dir, params());

    assert.equal(reportPath, join(dir, '.pitstop/reports/2026-10-19.md'));
    assert.equal(readFileSync(reportPath, 'utf8'), '# Pitstop report\n');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('commitState: writes state.json with the new last_run', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pitstop-commit-'));

  try {
    const { statePath } = commitState(dir, params());
    const state = JSON.parse(readFileSync(statePath, 'utf8'));

    assert.deepEqual(state, {
      version: 1,
      plugin_version: '0.1.0',
      last_run: { sha: 'a3f9e1c', date: '2026-10-19T10:00:00Z', level: 'full' },
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('commitState: writes .pitstop/.gitignore containing run/', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pitstop-commit-'));

  try {
    commitState(dir, params());
    assert.equal(readFileSync(join(dir, '.pitstop/.gitignore'), 'utf8'), 'run/\n');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('commitState: creates .pitstop/reports when .pitstop does not exist yet', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pitstop-commit-'));

  try {
    assert.equal(existsSync(join(dir, '.pitstop')), false);
    commitState(dir, params());
    assert.equal(existsSync(join(dir, '.pitstop/reports')), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('commitState: leaves no .tmp files behind', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pitstop-commit-'));

  try {
    const { reportPath, statePath } = commitState(dir, params());

    assert.equal(existsSync(`${reportPath}.tmp`), false);
    assert.equal(existsSync(`${statePath}.tmp`), false);
    assert.equal(existsSync(join(dir, '.pitstop/.gitignore.tmp')), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
