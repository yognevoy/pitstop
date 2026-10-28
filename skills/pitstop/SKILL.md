---
name: pitstop
description: Run a pit stop over the codebase since the last run. Use when asked to run a pit stop, "/pitstop", or periodic codebase maintenance.
disable-model-invocation: true
argument-hint: "[quick|full|deep]"
---

Run these steps in order, from the user's current project directory. `${CLAUDE_PLUGIN_ROOT}` is the plugin's own directory; every script path below is relative to it, not to the project.

If a *deterministic* step fails (a script exits non-zero), stop immediately: tell the user what failed and why, and do not run the remaining steps, in particular never reach step 7 (commit). An agent that can't complete in step 2 does not stop the run: see that step.

1. **Compute scope.** The level is `$ARGUMENTS`, trimmed. If it is `quick`, `full`, or `deep`, use it; otherwise (empty, or anything else) default to `full`. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/scope.js --level <level>`. This writes `.pitstop/run/scope.json` and `.pitstop/run/baseline.json`.

2. **Dispatch the three agents.** Read `.pitstop/run/scope.json`. If its `files` array is empty, there is nothing to review: write `[]` to `.pitstop/run/raw/simplifier.json`, `.pitstop/run/raw/reviewer.json`, and `.pitstop/run/raw/architect.json` directly, and skip to step 3.

   Otherwise, dispatch all three subagents in parallel, in one message with three Agent tool calls: `pitstop:simplifier`, `pitstop:reviewer`, `pitstop:architect`. Each reads `.pitstop/run/scope.json` and `.pitstop/run/baseline.json` and writes its own `.pitstop/run/raw/<name>.json`; none of them need further instructions from you.

   If one of the three doesn't complete (the Agent call errored, or came back without having written its file), that is not a fatal error for the run: continue with the other two. `validate.js` in step 3 already tolerates a missing raw file (it treats an agent that wrote nothing as having found nothing), so nothing else needs special-casing here.

3. **Validate.** Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/validate.js`. This writes `.pitstop/run/validated.json` and `.pitstop/run/rejected.json`.

4. **Cluster.** Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/cluster.js`. This reads `.pitstop/run/validated.json` and writes `.pitstop/run/clusters.json`: an array of clusters, each cluster an array of one or more findings that share an anchor file or symbol (the three agents flagging the same real problem from different angles end up in the same cluster).

5. **Merge clusters.** Read `.pitstop/run/clusters.json`. For every cluster with exactly one finding, keep it unchanged. For every cluster with two or more findings, merge them into exactly one finding in the same schema as the originals (`category` through `confidence`; no `score`):
   - `category`/`severity`: pick the one that best names the real underlying problem; when in doubt, use the more severe finding's values.
   - `agent`: the distinct agent names from the cluster, sorted and joined with `,` (e.g. `"architect,simplifier"`).
   - `anchors`: the union of all anchors, one entry per distinct file, symbols unioned per file.
   - `source`: the union of all source entries.
   - `title`/`what`/`problem`/`fix`/`if_skipped`: rewritten once, describing the one real problem and its one fix, drawing on everything the cluster's findings said; do not just concatenate them.
   - `effort`: your judgment for fixing the merged, combined problem.
   - `confidence`: your judgment; independent confirmation by more than one agent is itself evidence, so this can reasonably end up higher than any single finding's own confidence.

   Write the resulting array (merged clusters plus untouched singles, in any order) to `.pitstop/run/merged.json`. If `clusters.json` is `[]`, write `[]` directly without the step above.

6. **Score.** Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/score.js`. This reads `.pitstop/run/merged.json`, scores each finding, and writes `.pitstop/run/scored.json`.

7. **Commit.** Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/commit-state.js`. This builds the report from `.pitstop/run/scope.json` and `.pitstop/run/scored.json`, and writes `.pitstop/reports/<date>.md`, `.pitstop/state.json`, this run's `.pitstop/metrics/<date>.json` snapshot, `.pitstop/run/trends.json`, and a PNG chart under `.pitstop/charts/` for each `monotonic` trend (when rendering succeeds).

8. **Report trends.** Read `.pitstop/run/trends.json`. If it is `[]`, there isn't enough history yet (fewer than 2-3 runs) — skip this step. Otherwise it already holds the trends worth mentioning, picked and ordered by `commit-state.js` (preferring `burn_down`, then the largest `growth` values, then `monotonic`, with the lowest-priority pick swapped for a chart-bearing `monotonic` trend when otherwise none of the picks would have one): append a `## Trends` section to the end of the report file just written in step 7, one short sentence per entry in that order, citing its numbers directly — do not invent numbers not in the data. For an entry with a `chart` field, embed it as a markdown image (`![<metric> trend for <path>](<chart>)`); otherwise just state the trend in the sentence, with no image.

9. **Tell the user** the path to the report that was written, and a one-line summary (files in scope, how many findings made the report). Do not paste the full report text into the conversation; the user can open the file themselves.
