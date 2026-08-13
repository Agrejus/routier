# Benchmarks

```
npm run benchmark          # compare against the recorded baselines, fail on regression
npm run benchmark:update   # re-record the baselines from this run
```

Every scenario runs against `MemoryPlugin`, with warmup and a median over repeated
iterations. `npm run benchmark` fails any scenario more than `toleranceRatio` (15%) slower
than its baseline.

Baselines live in `baselines/baselines.json` alongside the platform they were recorded on.
They are machine-specific: a number recorded on one machine says nothing on another, so
compare only against a baseline you recorded yourself.

## Reading a result

A single run is not evidence. Run-to-run spread on a busy machine reaches 15% on its own,
which is the whole gate. Before believing a regression:

1. Run it three to five times and compare medians, not single numbers.
2. Check what else is running. Docker containers and a parallel test run both move these
   numbers by more than the tolerance.
3. Compare against the same commit twice before comparing two commits.

## Baseline history

### 2026-08-05 — re-recorded after a diffuse ~20% regression

`update-1000` and `diff-update-1000` had drifted past the gate. The regression is **real and
reproducible** — five runs at the old baseline's own commit reproduce it within 4%, and five
runs at HEAD do not overlap that range:

| | update-1000 | diff-update-1000 |
|---|---|---|
| `c038ffe`, where the old baseline was recorded | 1.92ms | 1.02ms |
| `8aba2a3` | 2.07ms | 1.19ms |
| `fb1c1a9` | 2.18ms | 1.26ms |
| HEAD | 2.26ms | 1.28ms |

It is **cumulative across roughly twenty commits, not one change**. Bisecting the eight
commits between `c038ffe` and `8aba2a3` one run each showed only noise — no step. Five-run
medians show the cost arriving in thirds: about half before the parser and replication work,
about a quarter with it, the rest after.

`Object.defineProperty` in the proxy `set` trap (the defect #26 fix) was the obvious suspect,
since that trap is the hottest path in the write route. **It is not the cause.** Reverting
that hunk and re-measuring gives 2.21ms / 1.29ms — indistinguishable from HEAD. Do not spend
time there again.

What is left is per-save work accumulating: optimistic concurrency, all-or-nothing
cross-collection persists, and subscription changes each add a little. Nothing in the profile
stands out as a single mistake, which is why this was re-recorded rather than fixed.

**If you want it back:** the target is `update-1000` at 1.92ms and `diff-update-1000` at
1.02ms. Profile a single `saveChanges` over 1,000 updated entities and look for work that is
per-entity rather than per-save.
