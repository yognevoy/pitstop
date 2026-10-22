import { sparkline } from './sparkline.js';

const TREND_METRICS = ['loc', 'duplicate_lines', 'open_findings'];
const OPENED_EVENTS = ['opened', 'reopened'];
const CLOSED_EVENTS = ['fixed', 'wontfix'];

/**
 * Trend rules over a chronological metrics snapshot history (oldest first,
 * this run's own snapshot already appended) plus the live registry:
 *
 * - growth: a file's metric grew by more than growthThreshold (a fraction)
 *   since the previous snapshot.
 * - monotonic: a file's metric has never decreased, and strictly increased
 *   overall, across the last monotonicRuns snapshots.
 * - burn_down: findings opened/reopened vs. fixed/wontfix'd since the
 *   previous run, from the registry's own history events.
 */
export function trends(history, registry, previousRunDate, options = {}) {
  const growthThreshold = options.growthThreshold ?? 0.3;
  const monotonicRuns = options.monotonicRuns ?? 3;

  const items = [...growthTrends(history, growthThreshold), ...monotonicTrends(history, monotonicRuns)];
  const burnDown = burnDownTrend(registry, previousRunDate);

  if (burnDown) {
    items.push(burnDown);
  }

  return items;
}

function growthTrends(history, threshold) {
  if (history.length < 2) {
    return [];
  }

  const previousByPath = indexByPath(history[history.length - 2].files);
  const latest = history[history.length - 1].files;
  const items = [];

  for (const file of latest) {
    const before = previousByPath[file.path];

    if (!before) {
      continue;
    }

    for (const metric of TREND_METRICS) {
      const growth = growthRatio(before[metric], file[metric]);

      if (growth !== null && growth > threshold) {
        items.push({ type: 'growth', path: file.path, metric, from: before[metric], to: file[metric], growth });
      }
    }
  }

  return items;
}

function growthRatio(before, after) {
  if (before === 0) {
    return after > 0 ? Infinity : null;
  }

  return (after - before) / before;
}

function monotonicTrends(history, runs) {
  if (history.length < runs) {
    return [];
  }

  const window = history.slice(-runs);
  const paths = commonPaths(window);
  const items = [];

  for (const path of paths) {
    for (const metric of TREND_METRICS) {
      const series = window.map((snapshot) => indexByPath(snapshot.files)[path][metric]);

      if (isMonotonicIncreasing(series)) {
        items.push({ type: 'monotonic', path, metric, series, sparkline: sparkline(series) });
      }
    }
  }

  return items;
}

function commonPaths(window) {
  const [first, ...rest] = window.map((snapshot) => new Set(snapshot.files.map((file) => file.path)));
  return [...first].filter((path) => rest.every((set) => set.has(path)));
}

function isMonotonicIncreasing(series) {
  const neverDecreased = series.every((value, i) => i === 0 || value >= series[i - 1]);
  return neverDecreased && series[series.length - 1] > series[0];
}

// shortcut: a plain string comparison, correct across different calendar
// days (pitstop's actual cadence) but not within the same day, since
// registry.js's `set` records history dates as YYYY-MM-DD while store()'s
// run-driven events use a full ISO timestamp; upgrade if same-day registry
// actions between runs become common.
function burnDownTrend(registry, previousRunDate) {
  if (!previousRunDate) {
    return null;
  }

  let opened = 0;
  let closed = 0;

  for (const record of registry) {
    for (const event of record.history) {
      if (event.date <= previousRunDate) {
        continue;
      }

      if (OPENED_EVENTS.includes(event.event)) {
        opened += 1;
      } else if (CLOSED_EVENTS.includes(event.event)) {
        closed += 1;
      }
    }
  }

  const openTotal = registry.filter((record) => record.status === 'open').length;

  return { type: 'burn_down', opened, closed, open_total: openTotal };
}

function indexByPath(files) {
  const map = {};

  for (const file of files) {
    map[file.path] = file;
  }

  return map;
}
