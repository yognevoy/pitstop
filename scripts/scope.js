import { parseArgs } from 'node:util';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { base } from './lib/base.js';
import { git } from './lib/git.js';
import { churn } from './lib/churn.js';
import { filterScope, parsePitstopIgnore } from './lib/ignore.js';
import { rank } from './lib/rank.js';

const MAX_FILES = { quick: 15, full: 40, deep: 80 };

export function scope(dir, level) {
  if (!(level in MAX_FILES)) {
    throw new Error(`Unknown level "${level}". Expected one of: ${Object.keys(MAX_FILES).join(', ')}.`);
  }

  const sha = lastRunSha(dir);
  const result = base(dir, sha);

  let range;

  if (result.method === 'last_run') {
    range = [`${result.base}..HEAD`];
  } else {
    range = [`--since=${result.since}`, 'HEAD'];
  }

  const files = churn(dir, range);
  const extraPatterns = readPitstopIgnore(dir);
  const kept = filterScope(dir, Object.keys(files), extraPatterns);

  const keptChurn = {};
  for (const path of kept) {
    keptChurn[path] = files[path];
  }

  return {
    version: 1,
    level,
    base: result,
    generated_at: new Date().toISOString(),
    files: rank(keptChurn, MAX_FILES[level]),
  };
}

function lastRunSha(dir) {
  const statePath = join(dir, '.pitstop/state.json');

  if (!existsSync(statePath)) {
    return null;
  }

  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  return state.last_run?.sha ?? null;
}

function readPitstopIgnore(dir) {
  const ignorePath = join(dir, '.pitstopignore');

  if (!existsSync(ignorePath)) {
    return [];
  }

  return parsePitstopIgnore(readFileSync(ignorePath, 'utf8'));
}

function main() {
  const { values } = parseArgs({
    options: {
      level: { type: 'string', default: 'full' },
    },
  });

  const dir = git(process.cwd(), ['rev-parse', '--show-toplevel']).trim();
  const outPath = join(dir, '.pitstop/run/scope.json');

  const result = scope(dir, values.level);

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`Wrote ${result.files.length} file(s) to ${outPath} (${result.base.method}: ${result.base.reason})`);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
