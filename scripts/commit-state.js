import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { git } from './lib/git.js';
import { report } from './lib/report.js';

const REPORT_TOP_K = 5;

/**
 * Writes the report and the new state.json atomically. 
 * Called only after every earlier step has already succeeded.
 */
export function commitState(dir, { report: reportText, sha, level, generatedAt, pluginVersion }) {
  const pitstopDir = join(dir, '.pitstop');
  const reportPath = join(pitstopDir, 'reports', `${generatedAt.slice(0, 10)}.md`);
  const statePath = join(pitstopDir, 'state.json');
  const gitignorePath = join(pitstopDir, '.gitignore');

  mkdirSync(dirname(reportPath), { recursive: true });

  const state = {
    version: 1,
    plugin_version: pluginVersion,
    last_run: { sha, date: generatedAt, level },
  };

  writeAtomic(reportPath, reportText);
  writeAtomic(statePath, JSON.stringify(state, null, 2));
  writeAtomic(gitignorePath, 'run/\n');

  return { reportPath, statePath };
}

function writeAtomic(path, content) {
  const tmpPath = `${path}.tmp`;

  writeFileSync(tmpPath, content);
  renameSync(tmpPath, path);
}

function main() {
  const dir = git(process.cwd(), ['rev-parse', '--show-toplevel']).trim();

  const scopePath = join(dir, '.pitstop/run/scope.json');
  const findingsPath = join(dir, '.pitstop/run/validated.json');
  const templatePath = new URL('../templates/report.md', import.meta.url);
  const pkgPath = new URL('../package.json', import.meta.url);

  const scope = JSON.parse(readFileSync(scopePath, 'utf8'));
  const findings = JSON.parse(readFileSync(findingsPath, 'utf8'));
  const template = readFileSync(templatePath, 'utf8');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

  const reportText = report(template, scope, findings, REPORT_TOP_K);
  const sha = git(dir, ['rev-parse', 'HEAD']).trim();

  const { reportPath, statePath } = commitState(dir, {
    report: reportText,
    sha,
    level: scope.level,
    generatedAt: scope.generated_at,
    pluginVersion: pkg.version,
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
