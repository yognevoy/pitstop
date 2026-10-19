import { git } from './git.js';

export const BUILTIN_IGNORE = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'npm-shrinkwrap.json',
  'composer.lock',
  'Gemfile.lock',
  'Cargo.lock',
  'go.sum',
  'poetry.lock',
  'node_modules/',
  'dist/',
  'build/',
  'vendor/',
  'migrations/',
  '*.min.js',
  '*.min.css',
];

/**
 * Matches a path against one simplified-gitignore-style pattern: `*` and `?`
 * glob within one path segment, a trailing `/` for a directory (matched at
 * any depth), and a pattern containing `/` anchored to the root.
 */
export function matchesPattern(path, pattern) {
  const trimmed = pattern.trim();

  if (!trimmed || trimmed.startsWith('#')) {
    return false;
  }

  const isDir = trimmed.endsWith('/');
  const body = isDir ? trimmed.slice(0, -1) : trimmed;
  const anchored = body.includes('/');

  const core = toRegex(body);
  const prefix = anchored ? '^' : '(?:^|.*/)';
  const suffix = isDir ? '(?:/.*)?$' : '$';

  return new RegExp(prefix + core + suffix).test(path);
}

export function isIgnored(path, patterns) {
  return patterns.some((pattern) => matchesPattern(path, pattern));
}

/** Parses `.pitstopignore` content into a list of patterns. */
export function parsePitstopIgnore(content) {
  const lines = content.split('\n');
  const patterns = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed && !trimmed.startsWith('#')) {
      patterns.push(trimmed);
    }
  }

  return patterns;
}

/** Checks whether a path still exists in the HEAD commit. */
export function existsAtHead(dir, path) {
  try {
    git(dir, ['cat-file', '-e', `HEAD:${path}`]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Filters a list of paths down to scope, drops files deleted by HEAD 
 * and from ignore list.
 */
export function filterScope(dir, paths, extraPatterns = []) {
  return paths.filter((path) => {
    if (!existsAtHead(dir, path)) {
      return false;
    }

    if (isIgnored(path, BUILTIN_IGNORE)) {
      return false;
    }

    if (isIgnored(path, extraPatterns)) {
      return false;
    }

    return true;
  });
}

function toRegex(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  return escaped.replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]');
}
