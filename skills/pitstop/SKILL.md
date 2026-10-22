---
name: pitstop
description: Run a pit stop over the codebase since the last run. Use when asked to run a pit stop, "/pitstop", or periodic codebase maintenance.
disable-model-invocation: true
argument-hint: "[quick|full|deep]"
---

Run these steps in order, from the user's current project directory. `${CLAUDE_PLUGIN_ROOT}` is the plugin's own directory; every script path below is relative to it, not to the project.

If any step fails (a script exits non-zero, or a dispatched agent can't complete), stop immediately: tell the user what failed and why, and do not run the remaining steps. In particular, never reach step 4 (commit) after a failure — a failed run must never update `state.json`.

1. **Compute scope.** The level is `$ARGUMENTS`, trimmed. If it is `quick`, `full`, or `deep`, use it; otherwise (empty, or anything else) default to `full`. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/scope.js --level <level>`. This writes `.pitstop/run/scope.json`.

2. **Dispatch agent.** Read `.pitstop/run/scope.json`. If its `files` array is empty, there is nothing to review: write `[]` to `.pitstop/run/raw/simplifier.json` directly and skip to step 3. Otherwise, dispatch the `pitstop:simplifier` subagent (Agent tool, `subagent_type: "pitstop:simplifier"`) to review the scope. It reads `.pitstop/run/scope.json` and writes `.pitstop/run/raw/simplifier.json` itself; it needs no further instructions from you.

3. **Validate.** Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/validate.js`. This writes `.pitstop/run/validated.json` and `.pitstop/run/rejected.json`.

4. **Commit.** Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/commit-state.js`. This builds the report from `.pitstop/run/scope.json` and `.pitstop/run/validated.json`, and writes `.pitstop/reports/<date>.md` and `.pitstop/state.json`.

5. **Tell the user** the path to the report that was written, and a one-line summary (files in scope, how many findings made the report). Do not paste the full report text into the conversation; the user can open the file themselves.
