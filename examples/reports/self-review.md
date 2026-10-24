# Pitstop report — 2026-10-24

**40 files** since 4 weeks ago → HEAD (no previous run recorded) · **3 findings** (2 should, 1 nice)

| # | Severity | Category | File | Title | Effort |
|---|----------|----------|------|-------|--------|
| 1 | should | duplication | scripts/commit-state.js, scripts/scope.js, scripts/validate.js | The CLI entry-point guard and try/catch wrapper around main() is copy-pasted verbatim into every scripts/*.js file | S |
| 2 | should | correctness | scripts/commit-state.js, scripts/score.js, scripts/lib/report.js | A finding already marked wontfix/fixed can still appear in the current run's report because the report is built from the raw scored findings before the registry's status is ever consulted. | S |
| 3 | nice | duplication | scripts/lib/cluster.js, scripts/lib/rank-findings.js | The lexicographic file-path tie-breaker is hand-written three separate times across the sort comparators | S |

### 1. The CLI entry-point guard and try/catch wrapper around main() is copy-pasted verbatim into every scripts/*.js file

*duplication · should · effort S*

**What:** Each CLI script ends with the identical 8-line block: a direct-execution check (`process.argv[1] && import.meta.url === ...`) followed by `try { main(); } catch (err) { console.error(err.message); process.exit(1); }`.

**Problem:** The exact same boilerplate is duplicated in at least six files (scripts/commit-state.js, scope.js, validate.js, score.js, cluster.js, registry.js). It is pure plumbing with no file-specific logic, so there is nothing to gain from six copies, and any future change to the error-handling convention (e.g. logging the stack, exit code, or the direct-execution check itself) has to be repeated six times by hand.

**Fix:** Add a `runCli(main)` helper in scripts/lib/cli.js that does the direct-execution check and the try/catch/exit(1), and have each script call `runCli(main)` as its last line instead of inlining the block.

**If skipped:** The duplicated block keeps getting copied into every new CLI script (already 6 and counting), and a future tweak to the error-handling convention silently misses one or more copies.

### 2. A finding already marked wontfix/fixed can still appear in the current run's report because the report is built from the raw scored findings before the registry's status is ever consulted.

*correctness · should · effort S*

**What:** commit-state.js's main() computes the report text directly from this run's scored.json (every finding the three agents produced, merged and scored) and only afterwards calls store() to update the on-disk registry. report()/rankFindings() never look at the registry at all, and score.js (which also has the registry available, read on line 17 of scripts/score.js) only uses it to look up seen_count for the recurring-bonus, never to drop a finding.

**Problem:** Nothing in the deterministic pipeline removes a finding whose id (category + sorted anchor files) already has status wontfix or fixed in the registry before it is rendered into this run's report. The only safeguard is `.pitstop/run/baseline.json` plus a prompt instruction in agents/simplifier.md, agents/reviewer.md and agents/architect.md telling the LLM subagent to skip 'something clearly the same problem'. If any of the three agents independently re-flags the same issue this run (worded differently, a different symbol subset, or simply because the prompt instruction is imperfectly followed), store() will correctly avoid creating a duplicate open registry record (it just bumps last_seen/seen_count on the existing wontfix/fixed record), but reportText was already built from the unfiltered scored array, so the dismissed finding shows up in '.pitstop/reports/<date>.md' for this run regardless. This contradicts the explicitly documented behavior in README.md ('It stays dismissed and won't resurface in future reports, even if the same code is touched again') and docs/PLAN.md's Phase 3 DoD ('a finding marked wontfix or fixed does not appear in subsequent reports') and P3.4 ('wontfix/fixed findings do not go into the report').

**Fix:** Before calling report() in scripts/commit-state.js's main(), filter `scored` (or have score.js do it) by excluding any finding whose recordId(finding.category, finding.anchors) matches a registry record with status 'wontfix' or 'fixed'. Concretely: look up each scored finding's id in the registry read via read(dir) (already loaded earlier in main() for store()), and drop it before passing to report(), the same way scope.js already builds baseline.json's wontfix map. Add a regression test in tests/commit-state.test.js or tests/lib/report.test.js that reproduces a wontfix'd finding resurfacing in scored input and asserts it is absent from the rendered report.

**If skipped:** A user who dismisses a finding as wontfix (with a reason) can still see it reappear in a later report any time an agent re-detects it, undermining the registry's entire purpose and the explicit guarantee in the README/FAQ, and eroding trust in the tool's triage workflow.

### 3. The lexicographic file-path tie-breaker is hand-written three separate times across the sort comparators

*duplication · nice · effort S*

**What:** cluster.js's compareForClustering and rank-findings.js's compareFindings (and rank-churn.js's compareFiles, outside this run's scope) each re-implement the same `pathA < pathB ? -1 : pathA > pathB ? 1 : 0` string comparison by hand as their final tie-break step.

**Problem:** Three near-identical, hand-rolled string comparisons for the same "break ties by path" rule stated once in CLAUDE.md, instead of one shared comparator.

**Fix:** Add a small `comparePath(a, b)` export (or just use `a.localeCompare(b)`) in a shared lib file and call it from the three comparators' final step.

**If skipped:** Low risk either way; mostly a readability nit since the logic is simple and unlikely to diverge.


