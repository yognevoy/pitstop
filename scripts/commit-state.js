import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { writeAtomic } from './lib/atomic-write.js';
import { loadConfig } from './lib/config.js';
import { git } from './lib/git.js';
import { report } from './lib/report.js';
import { read, store } from './lib/registry.js';

/**
 * Writes the report, the new state.json, and the registry atomically.
 * Called only after every earlier step has already succeeded.
 */
export function commitState(dir, { report: reportText, run, pluginVersion, registry = [] }) {
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

  return { reportPath, statePath };
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
  const reportText = report(template, scope, scored, config.report_top_k);
  const run = {
    sha: git(dir, ['rev-parse', 'HEAD']).trim(),
    date: scope.generated_at,
    level: scope.level,
  };

  // Registry records keep the content fields only: score/score_detail are
  // per-run (hotspot and seen_count shift between runs), not part of the
  // persisted finding.
  const contentFindings = scored.map(({ score, score_detail, ...finding }) => finding);
  const registry = store(read(dir), contentFindings, run);

  const { reportPath, statePath } = commitState(dir, {
    report: reportText,
    run,
    pluginVersion: pkg.version,
    registry,
  });

  console.log(`Wrote ${reportPath} and updated ${statePath}.`);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
