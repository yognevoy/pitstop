# pitstop

Periodic codebase maintenance: a pit stop looks at what changed since the last run, picks hot files from git history, reviews them for drift a normal review misses, and writes a short prioritized report. Run it weekly, after a sprint, or monthly — not every session.

Every script path below is relative to this file's own directory. If a level (`quick`, `full`, or `deep`) wasn't given, use `full`.

If a step that runs a script fails (exits non-zero), stop immediately and tell the user what failed; do not run the remaining steps, in particular never reach step 6 (commit).

1. **Compute scope.** Run `node scripts/scope.js --level <level>`. Writes `.pitstop/run/scope.json` and `.pitstop/run/baseline.json`.

2. **Review.** Read `.pitstop/run/scope.json`. If its `files` array is empty, write `[]` to each of `.pitstop/run/raw/simplifier.json`, `.pitstop/run/raw/reviewer.json`, `.pitstop/run/raw/architect.json` and skip to step 3.

   Otherwise, read those files (and, on a `deep` run, the whole repository — skip anything matching the built-in ignores or `.pitstopignore`) and review them yourself from three angles, one after another, writing one JSON array per angle to its own file. `.pitstop/run/baseline.json` maps a file path to findings already triaged as `wontfix`; don't re-report the same problem for a file listed there.

   Each finding needs exactly these fields: `category`, `severity` (`must`/`should`/`nice`), `agent` (the angle's name below), `title`, `anchors` (`[{file, symbols}]`, one entry per file actually involved, real symbol names only), `source` (`[{file, line, snippet}]`, a real line you read), `what`, `problem`, `fix`, `if_skipped`, `effort` (`S`/`M`/`L`), `confidence` (0-1; below 0.5, don't report it at all). Don't invent findings to fill a quota — `[]` is a valid outcome for a clean set of files. Don't guess line numbers or flag something you haven't actually read.

   **a. simplifier: `.pitstop/run/raw/simplifier.json`.** Categories: `duplication` (same logic in more than one place), `needless-abstraction` (a layer/interface/option nothing needs), `missed-reuse` (new code reinvents an existing helper), `overcomplexity` (a simpler, equally correct solution exists). `severity` is almost never `must` here — reserve that for duplication that already drifted out of sync or complexity that already caused an incident; the common case is `should`.

   **b. reviewer: `.pitstop/run/raw/reviewer.json`.** One category, `correctness`: a bug, data-loss risk, security issue, missed edge case, or quality regression in the period's changes. Read full files, not just diffs; use `git log -p -- <path>` to see what changed. `must` = a real bug/data-loss/security/crash reachable from normal use; `should` = a wrong-but-not-catastrophic edge case; `nice` = risky style that isn't wrong yet.

   **c. architect: `.pitstop/run/raw/architect.json`.** Categories: `module-boundary` (reaches into another module's internals, or an interface/module outgrew or shrank past its purpose), `scattered-behavior` (one coherent behavior implemented piecemeal across files with no owner), `cyclic-dependency` (modules import each other, directly or through a chain), `god-module` (one module has far more callers/imports/responsibilities than comparable modules). Judge the codebase against its own conventions, not an idealized architecture — check 2-3 comparable modules before calling something drift. Default to `should` or `nice`; `must` is almost never right here.

3. **Validate.** Run `node scripts/validate.js`. Writes `.pitstop/run/validated.json` and `.pitstop/run/rejected.json`.

4. **Cluster.** Run `node scripts/cluster.js`. Writes `.pitstop/run/clusters.json`: findings sharing an anchor file or symbol are grouped together.

5. **Merge clusters.** Read `.pitstop/run/clusters.json`. A cluster with one finding passes through unchanged. A cluster with two or more is merged into one finding in the same shape (no `score`): `category`/`severity` from whichever best names the real problem (default to the more severe); `agent` is the distinct angle names, sorted and joined with `,`; `anchors`/`source` are unioned; `title`/`what`/`problem`/`fix`/`if_skipped` rewritten once for the one real problem, not concatenated; `effort`/`confidence` are your judgment for the merged problem (independent agreement across angles can justify higher confidence than any single finding had). Write the result to `.pitstop/run/merged.json` (`[]` directly if `clusters.json` was `[]`).

6. **Score and commit.** Run `node scripts/score.js`, then `node scripts/commit-state.js`. Writes `.pitstop/reports/<date>.md`, `.pitstop/state.json`, this run's `.pitstop/metrics/<date>.json`, and `.pitstop/run/trends.json`.

7. **Report trends.** Read `.pitstop/run/trends.json`. If `[]`, skip. Otherwise pick 2-3 worth mentioning (prefer `burn_down`, then the largest `growth`, then `monotonic`) and append a `## Trends` section to the report file from step 6, one sentence per trend, citing its numbers directly — don't invent numbers not in the data, and skip a trend with no real change.

8. **Tell the user** the report's path and a one-line summary (files in scope, how many findings made the report). Don't paste the full report into the conversation.
