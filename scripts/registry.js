import { parseArgs } from 'node:util';
import { join } from 'node:path';
import { writeAtomic } from './lib/atomic-write.js';
import { git } from './lib/git.js';
import { read, setStatus } from './lib/registry.js';

function list(dir) {
  const open = read(dir).filter((record) => record.status === 'open');

  if (open.length === 0) {
    console.log('No open findings.');
    return;
  }

  for (const record of open) {
    console.log(
      `${record.id}  ${record.severity}  ${record.category}  ${record.title}  ` +
        `(seen ${record.seen_count}x, since ${record.first_seen.date.slice(0, 10)})`,
    );
  }
}

function set(dir, args) {
  const { positionals, values } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      reason: { type: 'string' },
    },
  });

  const [id, status] = positionals;
  const today = new Date().toISOString().slice(0, 10);

  const updated = setStatus(read(dir), id, status, { reason: values.reason, today });
  const record = updated.find((candidate) => candidate.id === id);

  writeAtomic(join(dir, '.pitstop/findings', `${id}.json`), JSON.stringify(record, null, 2));
  console.log(`${id} -> ${status}`);
}

function main() {
  const subcommand = process.argv[2];
  const dir = git(process.cwd(), ['rev-parse', '--show-toplevel']).trim();

  if (subcommand === 'list') {
    list(dir);
    return;
  }

  if (subcommand === 'set') {
    set(dir, process.argv.slice(3));
    return;
  }

  throw new Error(`Unknown registry subcommand "${subcommand}". Expected: list, set.`);
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
