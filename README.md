<h1 align="center">pitstop</h1>

<p align="center">
  <em>Box, box! Your codebase is coming in for service.</em>
</p>

<p align="center">
  <img alt="node" src="https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white">
  <img alt="license" src="https://img.shields.io/badge/license-MIT-111111">
</p>

pitstop is a Claude Code plugin for periodic codebase maintenance: run it weekly, after a sprint, or monthly. It looks at what changed since the last run and surfaces the cumulative drift (duplication, needless abstractions, drifting module boundaries) that per-change reviews miss.

## Install (local development)

Clone the repo, then from inside a Claude Code session in any project:

```
/plugin marketplace add /path/to/pitstop
/plugin install pitstop@pitstop
```

Run `/pitstop:pitstop` to confirm it loaded; it won't do anything yet.

To try a local checkout for a single session without installing it, start Claude Code with:

```bash
claude --plugin-dir /path/to/pitstop
```

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

## Scoring

Findings are ranked by a score:

```
score = severity_weight × hotspot × confidence / effort_weight × recurring_bonus
```

- `severity_weight` / `effort_weight`: looked up from `weights.severity`/`weights.effort` by the finding's `severity` (`must`/`should`/`nice`) and `effort` (`S`/`M`/`L`).
- `hotspot`: the finding's anchor file's commit count this run, normalized 0-1 against the busiest file in scope (max across anchors for a multi-file finding). Findings on frequently-changed files rank higher.
- `confidence`: the agent's own 0-1 confidence in the finding.
- `recurring_bonus`: `weights.recurring_bonus` once a finding has reappeared for 3+ runs, otherwise 1.

## License

[MIT](LICENSE)
