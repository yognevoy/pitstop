import { git } from './git.js';

/**
 * Parses `git log <range> --no-merges --numstat` into per-file stats: the
 * number of distinct commits that touched the file, and the total lines
 * added/deleted across those commits.
 */
export function churn(dir, range, pathspecs = []) {
  const scope = pathspecs.length ? ['--', ...pathspecs] : [];
  const out = git(dir, ['log', '-M', '--no-merges', '--numstat', '--format=%x00', ...range, ...scope]);
  const files = {};

  for (const block of out.split('\0').slice(1)) {
    const touched = new Set();

    for (const line of block.split('\n')) {
      if (!line.trim()) {
        continue;
      }

      const [added, deleted, pathField] = line.split('\t');
      const path = newPath(pathField);
      touched.add(path);

      if (!files[path]) {
        files[path] = { commits: 0, added: 0, deleted: 0 };
      }

      const stats = files[path];

      if (added !== '-') {
        stats.added += Number(added);
      }

      if (deleted !== '-') {
        stats.deleted += Number(deleted);
      }
    }

    for (const path of touched) {
      files[path].commits += 1;
    }
  }

  return files;
}

function newPath(field) {
  const brace = field.match(/^(.*)\{.* => (.*)\}(.*)$/);

  if (brace) {
    return `${brace[1]}${brace[2]}${brace[3]}`;
  }

  const simple = field.match(/^.* => (.*)$/);

  if (simple) {
    return simple[1];
  }

  return field;
}
