import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { commitState } from '../scripts/commit-state.js';

function params(overrides = {}) {
  return {
    report: '# Pitstop report\n',
    run: { sha: 'a3f9e1c', date: '2026-10-19T10:00:00Z', level: 'full' },
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
      last_run: params().run,
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

test('commitState: leaves an existing state.json untouched when it fails before reaching that step', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pitstop-commit-'));

  try {
    mkdirSync(join(dir, '.pitstop'), { recursive: true });
    const oldState = JSON.stringify({
      version: 1,
      plugin_version: '0.0.9',
      last_run: { sha: 'old-sha', date: '2020-01-01T00:00:00Z', level: 'full' },
    });
    writeFileSync(join(dir, '.pitstop/state.json'), oldState);

    // Forces mkdirSync(dirname(reportPath), { recursive: true }) to throw,
    // before commitState writes anything: 'reports' already exists as a file.
    writeFileSync(join(dir, '.pitstop/reports'), 'not a directory');

    assert.throws(() => commitState(dir, params()));
    assert.equal(readFileSync(join(dir, '.pitstop/state.json'), 'utf8'), oldState);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('commitState: writes each registry record under .pitstop/findings/<id>.json', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pitstop-commit-'));

  try {
    const registry = [{ id: 'f_abc12345', status: 'open', title: 'x', last_seen: params().run }];
    commitState(dir, params({ registry }));

    const written = JSON.parse(readFileSync(join(dir, '.pitstop/findings/f_abc12345.json'), 'utf8'));
    assert.deepEqual(written, registry[0]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('commitState: skips a registry record not touched this run', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pitstop-commit-'));

  try {
    const registry = [{ id: 'f_old', status: 'open', title: 'x', last_seen: { sha: 'older-sha' } }];
    commitState(dir, params({ registry }));

    assert.equal(existsSync(join(dir, '.pitstop/findings/f_old.json')), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('commitState: writes no findings when registry is omitted', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pitstop-commit-'));

  try {
    commitState(dir, params());
    assert.equal(existsSync(join(dir, '.pitstop/findings')), true);
    assert.deepEqual(readdirSync(join(dir, '.pitstop/findings')), []);
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

test('commitState: writes the metrics snapshot under .pitstop/metrics/<date>.json when given', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pitstop-commit-'));

  try {
    const snapshot = { version: 1, sha: params().run.sha, date: params().run.date, files: [], totals: { open_findings: 0 } };
    const { metricsPath } = commitState(dir, params({ metrics: snapshot }));

    assert.equal(metricsPath, join(dir, '.pitstop/metrics/2026-10-19.json'));
    assert.deepEqual(JSON.parse(readFileSync(metricsPath, 'utf8')), snapshot);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('commitState: writes each backfilled snapshot under its own .pitstop/metrics/<date>.json', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pitstop-commit-'));

  try {
    const backfill = [
      { version: 1, sha: 'old1', date: '2026-09-01T00:00:00Z', files: [], totals: { open_findings: 0 } },
      { version: 1, sha: 'old2', date: '2026-09-15T00:00:00Z', files: [], totals: { open_findings: 0 } },
    ];
    commitState(dir, params({ backfill }));

    assert.deepEqual(JSON.parse(readFileSync(join(dir, '.pitstop/metrics/2026-09-01.json'), 'utf8')), backfill[0]);
    assert.deepEqual(JSON.parse(readFileSync(join(dir, '.pitstop/metrics/2026-09-15.json'), 'utf8')), backfill[1]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('commitState: writes no metrics snapshot when omitted', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pitstop-commit-'));

  try {
    const { metricsPath } = commitState(dir, params());
    assert.equal(metricsPath, null);
    assert.equal(existsSync(join(dir, '.pitstop/metrics')), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('commitState: writes trends data to .pitstop/run/trends.json when given', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pitstop-commit-'));

  try {
    const trendsData = [{ type: 'burn_down', opened: 1, closed: 0, open_total: 1 }];
    commitState(dir, params({ trends: trendsData }));

    assert.deepEqual(JSON.parse(readFileSync(join(dir, '.pitstop/run/trends.json'), 'utf8')), trendsData);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('commitState: writes no trends.json when omitted', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pitstop-commit-'));

  try {
    commitState(dir, params());
    assert.equal(existsSync(join(dir, '.pitstop/run/trends.json')), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
