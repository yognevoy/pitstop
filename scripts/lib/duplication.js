import { git } from './git.js';

const DEFAULT_WINDOW = 6;

/**
 * Counts, per file, how many lines belong to a normalized N-line window that
 * also occurs elsewhere in the given file set (within or across files).
 */
export function detectDuplicates(dir, paths, windowSize = DEFAULT_WINDOW) {
  const linesByPath = {};

  for (const path of paths) {
    // shortcut: read via utf8, so a binary file produces garbled "lines"
    // instead of throwing; harmless since real duplicates won't match it.
    linesByPath[path] = git(dir, ['show', `HEAD:${path}`]).split('\n').map(normalizeLine);
  }

  return duplicateLineCounts(linesByPath, windowSize);
}

/** Pure version of detectDuplicates, over pre-read/normalized lines. */
export function duplicateLineCounts(linesByPath, windowSize = DEFAULT_WINDOW) {
  const occurrences = new Map();
  const windowsByPath = {};

  for (const [path, lines] of Object.entries(linesByPath)) {
    const windows = [];

    for (let start = 0; start + windowSize <= lines.length; start++) {
      const slice = lines.slice(start, start + windowSize);

      if (slice.every((line) => line === '')) {
        continue;
      }

      const key = slice.join('\n');
      windows.push({ start, key });
      occurrences.set(key, (occurrences.get(key) ?? 0) + 1);
    }

    windowsByPath[path] = windows;
  }

  const counts = {};

  for (const [path, windows] of Object.entries(windowsByPath)) {
    const duplicateLines = new Set();

    for (const { start, key } of windows) {
      if (occurrences.get(key) >= 2) {
        for (let i = start; i < start + windowSize; i++) {
          duplicateLines.add(i);
        }
      }
    }

    counts[path] = duplicateLines.size;
  }

  return counts;
}

/** Collapses whitespace and drops single-line comments (//, #, *) to blank. */
function normalizeLine(line) {
  const trimmed = line.trim().replace(/\s+/g, ' ');

  if (/^(\/\/|#|\*)/.test(trimmed)) {
    return '';
  }

  return trimmed;
}
