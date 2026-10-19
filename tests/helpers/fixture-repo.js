import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

const ISOLATED_ENV = {
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: '/dev/null',
};

const DEFAULT_AUTHOR = { name: 'Fixture', email: 'fixture@example.com' };

/**
 * Creates a temporary git repo for tests. Commits don't depend on the
 * global/system git config: author/committer identity and dates come from
 * explicit env vars per commit.
 */
export function createFixtureRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'pitstop-fixture-'));
  git(dir, ['init', '-q', '--initial-branch=main']);

  return {
    dir,
    run: (args) => git(dir, args),
    commit(files, { message = 'commit', date = '2024-01-01T00:00:00Z', author = DEFAULT_AUTHOR } = {}) {
      writeFiles(dir, files);
      git(dir, ['add', '-A']);

      const env = {
        GIT_AUTHOR_NAME: author.name,
        GIT_AUTHOR_EMAIL: author.email,
        GIT_AUTHOR_DATE: date,
        GIT_COMMITTER_NAME: author.name,
        GIT_COMMITTER_EMAIL: author.email,
        GIT_COMMITTER_DATE: date,
      };
      git(dir, ['commit', '-q', '-m', message], env);
      return git(dir, ['rev-parse', 'HEAD'], env).trim();
    },
    cleanup() {
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

function writeFiles(dir, files) {
  for (const [path, content] of Object.entries(files)) {
    const fullPath = join(dir, path);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content);
  }
}

function git(cwd, args, env = {}) {
  return execFileSync('git', args, {
    cwd,
    env: { ...process.env, ...ISOLATED_ENV, ...env },
    encoding: 'utf8',
  });
}
