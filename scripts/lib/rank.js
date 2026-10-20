/**
 * Ranks churn() results by number of commits, then by total changed lines,
 * then by path for a deterministic order; truncates to maxFiles.
 */
export function rank(churn, maxFiles) {
  const files = Object.entries(churn).map(([path, stats]) => ({
    path,
    commits: stats.commits,
    added: stats.added,
    deleted: stats.deleted,
  }));

  files.sort(compareFiles);

  return files.slice(0, maxFiles);
}

function compareFiles(a, b) {
  if (a.commits !== b.commits) {
    return b.commits - a.commits;
  }

  const changedA = a.added + a.deleted;
  const changedB = b.added + b.deleted;

  if (changedA !== changedB) {
    return changedB - changedA;
  }

  if (a.path < b.path) {
    return -1;
  }

  if (a.path > b.path) {
    return 1;
  }

  return 0;
}
