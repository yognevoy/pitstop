import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { loadConfig } from './lib/config.js';
import { git } from './lib/git.js';
import { read } from './lib/registry.js';
import { score } from './lib/score.js';

function main() {
  const dir = git(process.cwd(), ['rev-parse', '--show-toplevel']).trim();
  const mergedPath = join(dir, '.pitstop/run/merged.json');
  const scopePath = join(dir, '.pitstop/run/scope.json');
  const outPath = join(dir, '.pitstop/run/scored.json');
  const configSchema = JSON.parse(readFileSync(new URL('../schemas/config.schema.json', import.meta.url)));

  const merged = JSON.parse(readFileSync(mergedPath, 'utf8'));
  const scope = JSON.parse(readFileSync(scopePath, 'utf8'));
  const registry = read(dir);
  const config = loadConfig(dir, configSchema);

  const scored = score(merged, scope.files, registry, config.weights);

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(scored, null, 2));
  console.log(`Scored ${scored.length} finding(s), wrote ${outPath}.`);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
