<p align="center">
  <img src="assets/logo.png" width="220" alt="pitstop logo">
</p>

<h1 align="center">pitstop</h1>

<p align="center">
  <em>Box, box! Your codebase is coming in for service.</em>
</p>

<p align="center">
  <img alt="node" src="https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white">
  <img alt="license" src="https://img.shields.io/badge/license-MIT-111111">
</p>

pitstop is the crew chief for your codebase. It doesn't watch every lap: it waits for the scheduled stop (weekly, after a sprint, or monthly) and sends the car back out with the real problems fixed.

## How it works

It deterministically picks hot files straight from git history (how often they change, how big the change) and reviews them for the drift a normal review misses: duplication, abstractions nobody needed, module boundaries that quietly blurred. The output is a short report.

## Install

**Claude Code**, from inside a session in any project:

```
/plugin marketplace add yognevoy/pitstop
/plugin install pitstop@pitstop
```

Run `/pitstop:pitstop` to confirm it loaded; it won't do anything yet.

**Codex, Gemini CLI, OpenCode:** clone the repo, then point the host at it as a local extension/plugin the way it expects (Codex: `.codex-plugin/`; Gemini CLI: `gemini-extension.json`; OpenCode: `.opencode/commands/`). Each runs `/pitstop [quick|full|deep]`.

**Any other skill-capable agent:** copy [`AGENTS.md`](AGENTS.md) into your project and ask your agent to run it.

## Commands

| Command | What it does |
| --- | --- |
| `/pitstop:pitstop [quick\|full\|deep]` (Claude Code)<br>`/pitstop [quick\|full\|deep]` (other hosts) | Run a pit stop: scope the changes since the last run, review the hot files, validate and merge the findings, score them, and write `.pitstop/reports/<date>.md`. Defaults to `full`. |
| `/pitstop:registry` | List open findings, or mark one `wontfix`, `fixed`, or reopen it. Claude Code only for now. |

## Configuration

Optional. Create `.pitstop/config.json` at the root of your project to override any of these defaults:

```json
{
  "fallback_since": "4 weeks ago",
  "report_top_k": 5,
  "levels": {
    "quick": { "max_files": 15 },
    "full": { "max_files": 40 },
    "deep": { "max_files": 80 }
  },
  "weights": {
    "severity": { "must": 3, "should": 2, "nice": 1 },
    "effort": { "S": 1, "M": 1.5, "L": 2.5 },
    "recurring_bonus": 1.5
  }
}
```

You can set just the fields you want to change; everything else keeps its default.

### Ignoring files

Common lockfiles and build output are skipped by default. Add a `.pitstopignore` at the root of your project to exclude more:

```
*.generated.ts
vendor/
fixtures/
scripts/
!scripts/deploy.sh
```

These patterns are merged with the built-in ignore list.

### Project context

Add a `.pitstop/CONTEXT.md` at the root of your project to give the review agents free-form context: known constraints, intentional patterns, areas to go easy on or focus on. Each agent reads it if present and weighs it when judging a finding, but it never overrides something clearly wrong in the code.

## Scoring

Findings are ranked by a score:

```
score = severity_weight × hotspot × confidence / effort_weight × recurring_bonus
```

- `severity_weight` / `effort_weight`: looked up from `weights.severity`/`weights.effort` by the finding's `severity` (`must`/`should`/`nice`) and `effort` (`S`/`M`/`L`).
- `hotspot`: the finding's anchor file's commit count this run, normalized 0-1 against the busiest file in scope (max across anchors for a multi-file finding). Findings on frequently-changed files rank higher.
- `confidence`: the agent's own 0-1 confidence in the finding.
- `recurring_bonus`: `weights.recurring_bonus` once a finding has reappeared for 3+ runs, otherwise 1.

## CI

Copy [`examples/github-actions/pitstop.yml`](examples/github-actions/pitstop.yml) into `.github/workflows/` to run a pit stop on a schedule (weekly by default) instead of by hand. It needs an `ANTHROPIC_API_KEY` repository secret.

It never pushes straight to your default branch: it opens a PR with the report as the PR body and the updated `.pitstop/` (state, registry, metrics) as the diff, so the registry only advances once you merge it.

## FAQ

**Does it need a config file?**
No. `.pitstop/config.json` is optional; every field has a default (see [Configuration](#configuration)).

**Why not just review every diff?**
A per-change review only sees that one change. Drift accumulates across many changes nobody flagged individually, which is exactly what pitstop's "since the last run" window is built to catch.

**What happens to a finding I don't want fixed?**
`/pitstop:registry` to mark it `wontfix`, with a reason. It stays dismissed and won't resurface in future reports, even if the same code is touched again.

**Does it run automatically?**
Not by default. It's invoked explicitly, or scheduled via the [CI](#ci) example. It's deliberately not an always-on mode: it reviews what piled up since the last run, not every change as it happens.

## License

[MIT](LICENSE)
