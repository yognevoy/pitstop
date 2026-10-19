import { execFileSync } from 'node:child_process';

export class GitError extends Error {}

/**
 * Runs `git <args>` in dir via execFile and returns stdout.
 * Throws GitError with a clear message on failure.
 */
export function git(dir, args) {
  try {
    return execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  } catch (err) {
    throw new GitError(`git ${args.join(' ')} failed: ${(err.stderr || err.message).trim()}`);
  }
}
