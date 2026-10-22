import { git } from './git.js';

/**
 * Per-file snapshot: lines of code at HEAD, this run's churn (from scope),
 * duplicate line count, and open findings anchored to the file.
 */
export function metrics(dir, scopeFiles, registry, duplicatesByFile = {}) {
  const openCountByFile = countOpenFindings(registry);

  return scopeFiles.map((file) => ({
    path: file.path,
    loc: countLines(dir, file.path),
    commits: file.commits,
    added: file.added,
    deleted: file.deleted,
    duplicate_lines: duplicatesByFile[file.path] ?? 0,
    open_findings: openCountByFile[file.path] ?? 0,
  }));
}

// shortcut: read via utf8, so a binary file produces a garbled line count
// instead of throwing; harmless for a churn-ranked snapshot like this one.
function countLines(dir, path) {
  const content = git(dir, ['show', `HEAD:${path}`]);

  if (content === '') {
    return 0;
  }

  return content.split('\n').length - (content.endsWith('\n') ? 1 : 0);
}

function countOpenFindings(registry) {
  const map = {};

  for (const record of registry) {
    if (record.status !== 'open') {
      continue;
    }

    for (const anchor of record.anchors) {
      map[anchor.file] = (map[anchor.file] ?? 0) + 1;
    }
  }

  return map;
}
