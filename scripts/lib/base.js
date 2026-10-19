import { git } from './git.js';

export const DEFAULT_SINCE = '4 weeks ago';

/**
 * Decides what to diff scope against: the previous run's commit, if it's
 * still reachable from HEAD, or a time-based fallback otherwise.
 */
export function base(dir, sha, { since = DEFAULT_SINCE } = {}) {
  if (!sha) {
    return {
      method: 'fallback',
      base: null,
      since,
      reason: 'no previous run recorded',
    };
  }

  try {
    git(dir, ['merge-base', '--is-ancestor', sha, 'HEAD']);
  } catch {
    return {
      method: 'fallback',
      base: null,
      since,
      reason: `last run commit ${sha} is not an ancestor of HEAD`,
    };
  }

  return {
    method: 'last_run',
    base: sha,
    since: null,
    reason: `last run commit ${sha} is an ancestor of HEAD`,
  };
}
