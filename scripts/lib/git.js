import { execFileSync } from 'node:child_process';

export class GitError extends Error {}

/**
 * Runs `git <args>` in repoDir via execFile and returns stdout.
 * Throws GitError with a clear message on failure.
 */
export function git(repoDir, args) {
  try {
    return execFileSync('git', args, { cwd: repoDir, encoding: 'utf8' });
  } catch (err) {
    throw new GitError(`git ${args.join(' ')} failed: ${(err.stderr || err.message).trim()}`);
  }
}
