# Examples

## Reports

Real `/pitstop` output, unedited.

| Report | Run on | Findings |
|---|---|---|
| [self-review.md](reports/self-review.md) | pitstop's own repo, 2026-10-24, first run (`--level full`, 40 files, no prior `.pitstop/` state) | 2 should, 1 nice |

## CI

[`github-actions/pitstop.yml`](github-actions/pitstop.yml) — a scheduled workflow that runs a pit stop and opens a PR with the updated report and `.pitstop/` state.
