---
description: List or triage pitstop findings (mark wontfix, fixed, or reopen). Use for "/pitstop:registry", "list open findings", "mark this wontfix/fixed".
argument-hint: [list | set <id> <status> [--reason "..."]]
disable-model-invocation: true
---

`${CLAUDE_PLUGIN_ROOT}` is the plugin's own directory; every script path below is relative to it, not to the project.

The user's request: $ARGUMENTS

If the request is empty or just asks to see findings, run `node ${CLAUDE_PLUGIN_ROOT}/scripts/registry.js list` and show the result as a short table (id, severity, category, title, how long it's been open). Say so plainly if it's empty.

Otherwise, the request asks to change one finding's status. Resolve which finding they mean:
- If they gave an exact id (starts with `f_`), use it directly.
- Otherwise, run `list` first and match their description (e.g. "the VAT one") against the titles. If more than one plausibly matches, ask which one before doing anything.

Then run exactly one of:
- `node ${CLAUDE_PLUGIN_ROOT}/scripts/registry.js set <id> wontfix --reason "<reason>"` — a reason is required; if the user didn't give one, ask for it rather than inventing one.
- `node ${CLAUDE_PLUGIN_ROOT}/scripts/registry.js set <id> fixed`
- `node ${CLAUDE_PLUGIN_ROOT}/scripts/registry.js set <id> open` — to reopen a finding.

Report back in one line what changed (the id and its new status). Do not invent a finding id or status the user didn't ask for.
