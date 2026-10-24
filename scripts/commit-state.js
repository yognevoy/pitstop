import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { writeAtomic } from './lib/atomic-write.js';
import { backfillMetrics } from './lib/backfill.js';
import { renderChart } from './lib/chart.js';
import { loadConfig } from './lib/config.js';
import { detectDuplicates } from './lib/duplication.js';
import { git } from './lib/git.js';
import { metrics } from './lib/metrics.js';
import { report } from './lib/report.js';
import { read, selectFindings, store } from './lib/registry.js';
import { trends } from './lib/trends.js';

/**
 * Writes the report, the new state.json, the registry, the metrics
 * snapshot, and the trends data atomically. Called only after every earlier
 * step has already succeeded.
 */
export function commitState(dir, { report: reportText, run, pluginVersion, registry = [], metrics: metricsSnapshot = null, trends: trendsData = null, backfill = [] }) {
  const pitstopDir = join(dir, '.pitstop');
  const reportPath = join(pitstopDir, 'reports', `${run.date.slice(0, 10)}.md`);
  const statePath = join(pitstopDir, 'state.json');
  const gitignorePath = join(pitstopDir, '.gitignore');
  const findingsDir = join(pitstopDir, 'findings');

  mkdirSync(dirname(reportPath), { recursive: true });
  mkdirSync(findingsDir, { recursive: true });

  const state = { version: 1, plugin_version: pluginVersion, last_run: run };

  writeAtomic(reportPath, reportText);
  writeAtomic(statePath, JSON.stringify(state, null, 2));
  writeAtomic(gitignorePath, 'run/\n');

  for (const record of registry) {
    if (record.last_seen.sha === run.sha) {
      writeAtomic(join(findingsDir, `${record.id}.json`), JSON.stringify(record, null, 2));
    }
  }

  let metricsPath = null;

  if (metricsSnapshot || backfill.length > 0) {
    const metricsDir = join(pitstopDir, 'metrics');
    mkdirSync(metricsDir, { recursive: true });

    for (const snapshot of backfill) {
      writeAtomic(join(metricsDir, `${snapshot.date.slice(0, 10)}.json`), JSON.stringify(snapshot, null, 2));
    }

    if (metricsSnapshot) {
      metricsPath = join(metricsDir, `${run.date.slice(0, 10)}.json`);
      writeAtomic(metricsPath, JSON.stringify(metricsSnapshot, null, 2));
    }
  }

  if (trendsData) {
    const runDir = join(pitstopDir, 'run');
    mkdirSync(runDir, { recursive: true });
    writeAtomic(join(runDir, 'trends.json'), JSON.stringify(trendsData, null, 2));
  }

  return { reportPath, statePath, metricsPath };
}

function main() {
  const dir = git(process.cwd(), ['rev-parse', '--show-toplevel']).trim();

  const scopePath = join(dir, '.pitstop/run/scope.json');
  const scoredPath = join(dir, '.pitstop/run/scored.json');
  const templatePath = new URL('../templates/report.md', import.meta.url);
  const pkgPath = new URL('../package.json', import.meta.url);
  const configSchemaPath = new URL('../schemas/config.schema.json', import.meta.url);

  const scope = JSON.parse(readFileSync(scopePath, 'utf8'));
  const scored = JSON.parse(readFileSync(scoredPath, 'utf8'));
  const template = readFileSync(templatePath, 'utf8');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const configSchema = JSON.parse(readFileSync(configSchemaPath));

  const config = loadConfig(dir, configSchema);
  const prior = read(dir);
  const isNotDismissed = (record) => record.status !== 'wontfix' && record.status !== 'fixed';
  const reportable = selectFindings(scored, prior, isNotDismissed);
  const reportText = report(template, scope, reportable, config.report_top_k);
  const run = {
    sha: git(dir, ['rev-parse', 'HEAD']).trim(),
    date: scope.generated_at,
    level: scope.level,
  };

  // Registry records keep the content fields only: score/score_detail are
  // per-run (hotspot and seen_count shift between runs), not part of the
  // persisted finding.
  const contentFindings = scored.map(({ score, score_detail, ...finding }) => finding);
  const registry = store(prior, contentFindings, run);

  const previousRunDate = readPreviousRunDate(dir);
  const duplicatesByFile = detectDuplicates(dir, scope.files.map((file) => file.path));
  const metricsSnapshot = {
    version: 1,
    sha: run.sha,
    date: run.date,
    files: metrics(dir, scope.files, registry, duplicatesByFile),
    totals: { open_findings: registry.filter((record) => record.status === 'open').length },
  };

  const existingHistory = readMetricsHistory(dir);
  let backfill = [];

  if (existingHistory.length === 0 && scope.files.length > 0) {
    backfill = backfillMetrics(dir, scope.files.map((file) => file.path));
  }

  const history = [...backfill, ...existingHistory, metricsSnapshot];
  const trendsData = attachCharts(dir, run, trends(history, registry, previousRunDate));

  const { reportPath, statePath } = commitState(dir, {
    report: reportText,
    run,
    pluginVersion: pkg.version,
    registry,
    metrics: metricsSnapshot,
    trends: trendsData,
    backfill,
  });

  console.log(`Wrote ${reportPath} and updated ${statePath}.`);
}

function attachCharts(dir, run, trendsData) {
  const date = run.date.slice(0, 10);
  const chartsDir = join(dir, '.pitstop/charts');

  return trendsData.map((item) => {
    if (item.type !== 'monotonic') {
      return item;
    }

    const safePath = item.path.replace(/[^a-zA-Z0-9.-]+/g, '_');
    const filename = `${date}-${item.metric}-${safePath}.png`;
    const ok = renderChart(item.series, join(chartsDir, filename), { label: item.metric });

    if (!ok) {
      return item;
    }

    return { ...item, chart: `../charts/${filename}` };
  });
}

function readPreviousRunDate(dir) {
  const statePath = join(dir, '.pitstop/state.json');

  if (!existsSync(statePath)) {
    return null;
  }

  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  return state.last_run?.date ?? null;
}

function readMetricsHistory(dir) {
  const metricsDir = join(dir, '.pitstop/metrics');

  if (!existsSync(metricsDir)) {
    return [];
  }

  return readdirSync(metricsDir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => JSON.parse(readFileSync(join(metricsDir, name), 'utf8')));
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
