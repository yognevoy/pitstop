import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderChart } from '../../scripts/lib/chart.js';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

test('renderChart: writes a real PNG file for a real render', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pitstop-chart-'));
  const outputPath = join(dir, 'chart.png');

  try {
    const ok = renderChart([1, 2, 3, 5, 4, 6], outputPath);

    assert.equal(ok, true);
    const buf = readFileSync(outputPath);
    assert.ok(buf.subarray(0, 4).equals(PNG_MAGIC));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('renderChart: creates missing parent directories', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pitstop-chart-'));
  const outputPath = join(dir, 'nested', 'chart.png');

  try {
    const ok = renderChart([1, 2, 3], outputPath);
    assert.equal(ok, true);
    assert.ok(existsSync(outputPath));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('renderChart: returns false and writes nothing when rendering fails', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pitstop-chart-'));
  const outputPath = join(dir, 'chart.png');

  try {
    const ok = renderChart([1, 2, 3], outputPath, {
      createCanvasFn: () => {
        throw new Error('no precompiled binary for this platform');
      },
    });

    assert.equal(ok, false);
    assert.equal(existsSync(outputPath), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
