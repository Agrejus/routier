# Handoff

Branch `v0.2.2`. Everything is committed; every commit is a working checkpoint.

```
c32dee4  S5: many stores on one database
d2990dc  S11: volume + churn through .immutable()
22412af  Freeze immutable reads
e85f761  Make .immutable() actually work
658c28a  Queries honour the collection's change-tracking mode
e8274f2  Safety point (this session's work + the pre-existing uncommitted tree)
```

**5,460 functional + 41 stress passing.** `npx jest --forceExit` and
`STRESS=1 npx jest --selectProjects stress --forceExit`.

## What exists now

- **`stress/`** — new workspace, gated on `STRESS=1`. Harness (seeded RNG, independent Map
  oracle, poll-with-deadline, RSS growth-rate leak detection, per-backend volume budgets) is
  self-tested. **8 of 11 scenarios built** — see below.
- **An immutable write path** — `collection.update(entity, patch)`, `.immutable()` collections
  with frozen un-proxied reads. ~3x faster reads than the proxy default. Proxy remains the
  default; both paths coexist.
- **`@routier/sql-plugin-core`** — SQL dialects moved out of core. Core now contains no engine
  name; `specs/core-agnosticism.md` has the rule and the grep that enforces it.

## The S-numbered scenarios

"S" = scenario. **S1–S9 come from `specs/stress-testing.md`**, which already existed before this
work. **S10 and S11 were added here** to cover the immutable path, which the spec predates.

| | Stresses | Status | Found |
| --- | --- | --- | --- |
| S1 | Volume: 100k adds + mixed churn, one collection | Done | **#11** — a persisted entity never went clean; a removed row was resurrected. Fixed. |
| S2 | Wide and deeply-nested shapes, 10k each | Done | **#12**, **#13**. Both open; 2 of 8 cases pinned. |
| S3 | Churn: 10k mutation cycles + RSS leak bound | Done | No leak. Guards the #11 fix over 10k cycles. |
| S4 | Concurrency: 20 workers x 200 saves, one store | Done | Nothing. Hunted the `SelectionQueryable` snapshot/restore race and pipeline reentrancy — clean. |
| S5 | Many stores on one database; leaked handles | Done | **#18**. Also proved subscription channels do *not* leak. |
| S6 | Views and subscriptions under write pressure | **Not built** | |
| S7 | `OptimisticUpdatesDbPlugin` under lag | **Not built** | |
| S8 | Real databases via testcontainers | **Not built** | |
| S9 | Throughput regression floor | Done | Baseline recorded (123k inserts/s, 370k reads/s). |
| S10 | Immutable path driven via stale references | Done | 500k increments through first-generation refs, none lost. |
| S11 | S1 and S3 workloads through `.immutable()` | Done | Passes; ~9x faster per churn cycle. |

Two things about this table that are easy to get wrong:

- **S-numbers and #-numbers are unrelated sequences.** S2 has nothing to do with defect #2.
  Defects #1–#10 predate this work; #11–#18 came out of it.
- **The performance wins did not come from a scenario.** They came from debugging why S1
  appeared to hang (it was Jest pretty-formatting 100k proxies in a failure message), which led
  to measuring the save path. The scenarios found the correctness defects; the perf findings
  were a side effect.

## Read these three specs first

`specs/known-defects.md` (18 numbered defects, the pinning convention, what is open),
`specs/stress-testing.md` (scenario spec + implementation status + measured perf),
`specs/immutable-updates.md` (the design and what it does not yet prove).

## Open defects

**#12** arrays untracked after merge, **#13** depth-2 delta throws — both proxy-path only, both
disappear on the immutable path. **#14** `serialize` throws on a partial entity (worked around
in `ChangeTracker.serializeDelta`). **#18** concurrent stores on one file-system database lose
data.

## Gotchas that cost me real time

- **Never pass a large collection to a Jest matcher.** Pretty-formatting 100k proxies takes
  longer than the scenario; the failure looks like a hang. Use `compareToOracle`.
- **`TranslatedArrayValue.forEach` is a map-in-place** — it reassigns each slot to whatever the
  callback returns. A block body returning nothing silently leaves plugin objects in the
  result array and saves then report zero changes. Cost me 13 sqlite tests.
- **Cross-run millisecond comparisons are worthless here.** Absolutes drifted 2.6x across one
  session from machine load. Measure A/B in one process, or normalise against an untouched
  reference path.
- **`--forceExit` is still needed, but subscription channels are NOT the cause** — S5 proves
  they release cleanly. Next suspects: the memory-plugin `dbs` registry, the sqlite driver.

## Next

S6 (views under write pressure — note `View` uses `"immutable"` mode so views are now frozen;
check that before anything else), S7 (`OptimisticUpdatesDbPlugin` under lag), S8 (containers —
the SQL nested-column work is unverified against real Postgres).
