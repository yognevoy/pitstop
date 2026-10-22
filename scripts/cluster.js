import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { cluster } from './lib/cluster.js';
import { git } from './lib/git.js';

function main() {
  const dir = git(process.cwd(), ['rev-parse', '--show-toplevel']).trim();
  const inPath = join(dir, '.pitstop/run/validated.json');
  const outPath = join(dir, '.pitstop/run/clusters.json');

  const findings = JSON.parse(readFileSync(inPath, 'utf8'));
  const clusters = cluster(findings);

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(clusters, null, 2));
  console.log(`Wrote ${clusters.length} cluster(s) from ${findings.length} finding(s) to ${outPath}.`);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
