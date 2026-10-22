/**
 * Groups findings into connected components: two findings are linked if
 * they share an anchor file or symbol. Findings are sorted first, so
 * output order is deterministic regardless of input order.
 */
export function cluster(findings) {
  const sorted = [...findings].sort(compareForClustering);
  const keys = sorted.map(keysOf);
  const visited = new Array(sorted.length).fill(false);
  const clusters = [];

  for (let i = 0; i < sorted.length; i++) {
    if (visited[i]) {
      continue;
    }

    const members = [i];
    visited[i] = true;
    let cursor = 0;

    while (cursor < members.length) {
      const current = members[cursor];
      cursor += 1;

      for (let j = 0; j < sorted.length; j++) {
        if (visited[j]) {
          continue;
        }

        if (overlaps(keys[current], keys[j])) {
          visited[j] = true;
          members.push(j);
        }
      }
    }

    clusters.push(members.map((index) => sorted[index]));
  }

  return clusters;
}

function compareForClustering(a, b) {
  const pathA = a.anchors[0].file;
  const pathB = b.anchors[0].file;

  if (pathA !== pathB) {
    return pathA < pathB ? -1 : 1;
  }

  if (a.title !== b.title) {
    return a.title < b.title ? -1 : 1;
  }

  return 0;
}

function keysOf(finding) {
  const keys = new Set();

  for (const anchor of finding.anchors) {
    keys.add(`file:${anchor.file}`);

    for (const symbol of anchor.symbols) {
      keys.add(`symbol:${symbol}`);
    }
  }

  return keys;
}

function overlaps(a, b) {
  for (const key of a) {
    if (b.has(key)) {
      return true;
    }
  }

  return false;
}
