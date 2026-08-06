# Stress-testing spec

Status: **Fully implemented** — S1–S12 built; S8 additionally needs Docker
Date: 2026-08-03
Audience: an agent with no prior context on this repository.

## Implementation status (2026-08-03)

`STRESS=1 npx jest --selectProjects stress`. No `--forceExit` — see the deviation note.
Add `E2E_CONTAINERS=1` for S8, and `NODE_OPTIONS=--expose-gc` for the memory verdict in S3 —
without it that assertion is skipped rather than guessed at (see "Measuring memory" below).

| Scenario | State | Notes |
| --- | --- | --- |
| S1 volume, single collection | Done | memory 100k, file-system 5k, sqlite 20k — see the budget note below |
| S2 wide schemas / deep nesting | Done | 2 of 8 cases pinned to defects #12 and #13 |
| S3 churn | Done | 10k cycles, ~87s, no leak detected |
| S4 concurrency, one store | Done | 20 workers x 200 saves, no race found |
| S5 many stores, one database | Done | memory passes; file-system pinned to defect #18. Handle-leak invariant passes. |
| S6 subscriptions and views | Done | 5k products, ~58s. Nothing broken; measured the derive cost, below |
| S7 replication under lag | Done | 2k saves against a source lagging 10–50ms. Nothing broken |
| S8 real databases | Done | **Found defects #19, #20, #21, #22.** The volume load passes; everything else is pinned |
| S9 throughput floor | Done | ratio against an in-process reference workload; baseline in `stress/src/throughput-baseline.json`. Was flaky in a full run, fixed by normalising |
| S10 immutable stale refs | Done | 10k generations through first-generation references |
| S11 immutable volume + churn | Done | S1 and S3 workloads through `.immutable()` |
| S12 application session | Done | 12 related collections, 6 screens, a 400-step journey. The first scenario with more than one collection or more than one query shape |

## S12: an application, not a load (2026-08-06)

S1 through S11 all drive ONE collection through ONE kind of work at the highest rate they can.
That shape finds volume and churn defects and structurally cannot find anything that needs a
second collection or a second query shape — which is most of what an application is. Before
S12: no scenario had two related collections, none paginated, `specs/joins.md` had never been
stressed, and defect #48 (a paginated read returning `[]`) needed nothing more exotic than a
second query shape to exist.

S12 is twelve collections with real references, six screens with distinct query shapes, and a
seeded journey that moves between them the way a person does. It is deliberately smaller and
slower than S1 — the subject is the ORDER of operations across collections, not the rate.

**What it asserts** (`stress/src/harness/application/invariants.ts`). Each claim needs either
two collections or two query shapes, which is why none could be made before:

| Invariant | The failure it catches |
| --- | --- |
| Referential integrity | A remove that leaves children pointing at a parent that is gone |
| Pagination completeness | Pages that do not add up to the unpaged answer — gaps, duplicates, or lost ordering |
| Denormalised counts | A cached aggregate drifting from the rows it counts |
| Model agreement | The store and a plain-Map reference diverging, including on composite keys |
| Collection isolation | A save reaching a collection it was not given |

The last one compares content FINGERPRINTS rather than counts. An update never changes a count,
so a count comparison there would look like a check while checking nothing.

**The invariants have their own tests**, ungated, in
`stress/src/harness/application/invariants.test.ts`. Each breaks the store in one specific way
and asserts the matching invariant fires and the others stay quiet. A green check that cannot
go red is not a check, and S12 passed on its first run — which was worth nothing until each
claim had been shown to fail on the corruption it exists to catch.

**The model is deliberately scalar-only.** No booleans, dates, arrays or nested objects, so the
same session runs unchanged on memory, file-system and SQLite and a divergence between them is
a finding rather than a known limitation. Ids are derived from the seed rather than `uuidv4()`,
so a failing run replays.

## Measuring memory (2026-08-06)

S3's leak check samples **retained heap after a forced collection**, not RSS.

It used to sample RSS with no collection and compare the growth rate of the last third
against the first. That measured when V8 chose to collect, not what the run held, and it was
wrong in both directions. On CI it reported LEAKING every time — RSS climbed 233MB to 491MB
with a decay ratio of 0.95 to 1.00, because a runner with headroom defers collection and RSS
rises linearly. Locally it passed, but only by abstaining: a collection landed early, the
first-third slope went negative, and the `firstThird <= 0` guard returned "undecidable" while
the last third was climbing at 65KB/cycle. A green tick meaning "could not measure" is worse
than a red one.

Forcing a collection settles it. On the workload that showed +206MB of RSS growth, retained
heap moved 294.0MB → 294.5MB over 10,000 cycles. There is no leak; there never was.

Two consequences for anyone reading a result:

- **`NODE_OPTIONS=--expose-gc` is required for the assertion to run at all.** Without it
  `verdict()` reports `measurable: false`, the scenario notes that it did not assert, and it
  passes. Do not read that pass as evidence.
- **Flat is a verdict, not an absence of one.** A steady working set is the healthy shape and
  is now reported as such, rather than as "no early growth to compare".

**Where the loads live.** S1's volume load and S3's churn load are in
`stress/src/harness/workloads.ts`, and their entity shapes in `stress/src/harness/shapes.ts`,
because S8 re-runs both against PostgreSQL at a smaller scale. A second hand-written copy of a
load drifts, and once it drifts the two scenarios stop hunting the same defect. The shapes sit in
the harness rather than in S1/S3 for a mechanical reason: importing them from a `.test.ts` file
would execute that file's `describe` and `afterEach` registrations in the importer's scope, and
Jest would run S1 twice with the wrong teardown.

**Defects found so far** (all recorded in `specs/known-defects.md`, all reducible to a
handful of entities once found):

- **#11 — a persisted entity never went clean. FIXED.** Update counts climbed save over
  save, `previewChanges` never reached zero, and a removed row was resurrected by any
  later unrelated save.
- **#12 — arrays stop being change-tracked after the entity's first merge. OPEN, pinned.**
  Silent data loss on in-place array writes.
- **#13 — saving a mutation two or more levels deep throws. OPEN, pinned.** The delta is a
  flat dotted-path map, and the delta serializer walks it as if it were an entity.
- **#19 — an `s.array()` property cannot be written to PostgreSQL. OPEN, pinned.** The array is
  bound to a `json` column and `pg` encodes it as a PostgreSQL array literal, which is not JSON.
- **#20 — a nested object still emits a column per descendant on the PostgreSQL path. OPEN,
  pinned.** Spurious when names are unique; a rejected statement when a descendant name collides
  with a top-level property. Same shape as #15, which was fixed only for SQLite.
- **#21 — the first concurrent write to a new collection loses all but one. OPEN, pinned.** Five
  instances race to `CREATE TABLE` the same table; four collide in the system catalog and their
  rows are gone.
- **#22 — one save cannot update two entities whose changed columns differ. OPEN, pinned.** The
  builder `;`-joins one UPDATE per changed-column group into a single prepared statement, which
  PostgreSQL forbids. The broadest of the four: no nested types, no arrays, no concurrency.

**What S6 and S7 found: nothing broken, and two measurements worth keeping.**

*A view derive is O(all rows), not O(the change.)* `derive` receives the source collection's
entire result set on every notification, re-enriches all of it, re-queries the view by every id,
and hashes each row to diff it. So one 50-entity save costs whatever the collection it lands in
costs. Convergence after 100 batches of 50, memory plugin:

| products | writes | convergence |
| --- | --- | --- |
| 500 | 14ms | 270ms |
| 2,000 | 83ms | 5.3s |
| 5,000 | 213ms | 61s |

Writes stay linear and cheap; convergence is roughly quadratic. A property of the full-recompute
design rather than a defect, but it caps how large a view can be while its source is under
sustained write pressure, and it is why S6 runs at 5,000 — the next power up does not fit the
5-minute per-file budget.

*View notifications are heavily coalesced, and that is fine.* 100 view-changing saves produce
**two** notifications per subscriber, because a send arriving while a subscriber's re-query is in
flight folds into that query's result rather than queuing another. So S6's notification bound
passes by a wide margin and is not a tight check — what holds the coalescing honest is the
separate assertion that a subscriber's LAST notification reflects the settled data. Without that
one, the bound is vacuous: a subscriber that fires twice and then goes stale would pass it.

**Performance work it turned up:**

The save path scanned every attached entity to find the dirty ones, and read
`attachment.doc.__tracking__` to do it — through a Proxy, so once per entity per save.
Measured over 100k attachments: 186ns/entity through the trap, 17ns via a direct
reference (the floor for iterating the Map at all). Caching `__tracking__` on the
attachment record, at 100k attached entities:

| | before | after |
| --- | --- | --- |
| `saveChanges` with nothing pending | 14.55ms | 0.56ms |
| `saveChanges` with 1 change | 15.01ms | 0.60ms |
| `hasChanges` | 14.92ms | 0.55ms |
| `saveChanges` with 1,000 changes | 22.69ms | 7.44ms |

The shape matters more than the multiple: save cost is now proportional to the changeset
rather than to the attachment set. The 1,000-change save is flat (~7ms) from 1k to 100k
attached entities, where before it grew with the collection.

The same theme showed up again on the read path. The proxy's `set` trap built
`String(property)` *before* checking whether the value had actually changed — and a write
that changes nothing is the common case, because `schema.merge` copies every property of
a re-read row into the attached entity. Measured over 200k identical-value writes:
156ns/write, of which 125ns was the `String()` call; checking first takes it to 31ns
against a 14ns plain-object floor. Over 50k entities:

| | before | after |
| --- | --- | --- |
| `schema.merge` into attached docs | 57.1ms | 35.2ms |
| `toArrayAsync`, re-read | 175.9ms (3.52µs/entity) | 145.7ms (2.91µs/entity) |
| S3 scenario wall clock | 92.4s | 83.7s |

**What is left on the read path, and what is not yet known.** Of a 146ms re-read of 50k
entities, `postprocess` (enrich + proxy install) is ~30ms and `merge` ~35ms — about 45%
between them. The other ~55% is the plugin query plus the queryable pipeline and has not
been decomposed. An attempt to isolate it by comparing against an untracked projection
read was **inconclusive**: the projection runs its own per-entity selector and allocates
new objects, so it came out no faster and is not a valid control. Isolating that half
needs a real profile, not a comparison read.

**Deviations from this spec, and why:**

- *Per-backend volume budgets in S1.* FileSystemPlugin rewrites a whole JSON file per
  save, making a run quadratic in the entity count, and SQLite pays fsync per batch.
  100k on those backends does not fit the 5-minute budget. Budgets live in
  `stress/src/harness/backends.ts` and are printed in every failure banner.
- *S3 samples `previewChangesAsync` every 25 cycles* rather than after every save; the
  cheap equivalent (`hasChangesAsync`) runs after every save. Rationale in the file.
- *`--forceExit` is no longer required* (2026-08-03). Both `npx jest` and
  `STRESS=1 npx jest --selectProjects stress` exit on their own. S5 was right that
  subscription channels release correctly when a store is torn down — what it could not see
  is that a channel pair is opened per collection **at construction**, so a store nobody
  disposes leaks two `MessagePort` handles whether or not it ever subscribed. Two production
  defects and seven undisposed test files; the full account is in `known-defects.md` under
  "The `--forceExit` question, answered".
- *S8 does not run the churn load against SQLite*, which the spec asks for. The volume half is
  already covered — `sqliteBackend` is a real file and S1 drives the same load through it at 20k.
  The churn half cannot be: its shape holds a boolean, a date, an array and a nested object, and
  SQLite has a column type for none of them and declines rich types in its own contract run.
  Running it there would exercise the fallback path rather than SQLite.
- *S8's churn scenario has an unverified budget.* Its entity count is reduced from S3's 1,000 to
  200 because every cycle re-reads the whole collection and that multiplies round trips to a real
  server. But #19 rejects its first insert and #22 would reject its first save, so 2,000 cycles
  against PostgreSQL has never actually run — the reduction is a projection, not a measurement.
  Whoever fixes #19 and #22 should time it before trusting the 5-minute budget.
- **S9 was flaky in a full-suite run. FIXED (2026-08-03) by normalising.** It failed twice in
  roughly nine full runs and never in isolation, because it measured wall-clock throughput inside
  a Jest worker while up to eleven other stress suites saturated every core. A loose floor and
  best-of-3 rounds were not enough, and loosening the floor further would have left a check that
  could no longer detect what it exists for.

  It now measures a **reference workload** — plain `Map` inserts and reads, no Routier involved —
  in the same process and the same round, and compares the *ratio* of Routier throughput to
  reference throughput against a recorded baseline ratio. Contention scales both numbers, so it
  cancels; a real regression moves only the numerator. The rates are still recorded and printed,
  because a human reading a failure wants them, but nothing compares against them.

  Three consecutive full-suite runs pass. That is not proof against a failure that appeared twice
  in nine — if it recurs, the thing to check is whether the reference workload is still measuring
  contention rather than something else, not whether the floor is too tight.

  The baseline file changed shape, and a pre-ratio baseline is treated as absent and re-recorded
  rather than compared against — a ratio checked against a rate would fail every run.

- *S7 must yield to the timer queue explicitly.* An `await` chain over in-process plugins resolves
  through microtasks and never reaches the macrotask queue, so delayed mirror callbacks do not
  fire at all during the run. Measured before the fix: a backlog of 2,000 out of 2,000, meaning
  the scenario tested a mirror that was **stopped** rather than one that was behind, and the
  mirror-ordering hunt was silently vacuous. With a yield every 10 saves the backlog peaks at 88
  and 1,950 of 2,000 callbacks land mid-run. `LaggingPlugin.stats.completedCallbacks` exists so a
  scenario can assert the difference instead of assuming it.

## Goal

Find defects that the functional suite cannot see: data loss under volume, races under
concurrency, unbounded memory growth, and throughput collapse. The functional suite is green and
stable, which is the point: it was green while every defect this suite has found was already
present. `specs/known-defects.md` now holds 22 entries; #12, #13, #14, #18, #19, #20, #21 and #22
are open and pinned. Do not re-test single-operation correctness — stress the system until it
breaks, then pin what broke.

(The line this paragraph replaces said "all 14 defects are fixed", which was true the day the
spec was written and has been wrong since. Treat the table at the top as the current state, not
this section.)

## Prior art in this repository

Read these before you write code:

| Path | What it gives you |
| --- | --- |
| `specs/known-defects.md` | The defect workflow, past failure modes, and the pinning convention |
| `test-utils/src/shapeCatalog.ts` | 55 compiled schema shapes — reuse them, do not invent schemas |
| `test-utils/src/generatorInvariants.ts` | Invariant assertions you can borrow (roundtrip, clone isolation) |
| `test-utils/src/pluginContract.ts` | The per-plugin behavioral contract and its datastore fixtures |
| `test-utils/src/dataGenerator.ts` | `generateData(schema, n)` — the standard entity factory |
| `plugins/memory/src/tests/datastore/MemoryDatastore.ts` | A full datastore with collections AND views — the view wiring matters for stress |
| `e2e/src/postgresContainer.test.ts` | The testcontainers pattern for real-database tests |

## Where the code goes

Create a new workspace project `stress/` beside `e2e/`. Follow the `e2e/` layout: its own
`package.json`, its own jest project entry, gated behind an environment variable.

Rules:

1. Gate every stress suite behind `STRESS=1`. The default `npx jest` run must not execute them.
2. Give each scenario its own file. One scenario file must run alone in under 5 minutes.
3. Use fixed seeds. A failure must reproduce from the seed printed in the failure message.
4. Print the scenario's scale numbers (entities, iterations, stores) in the failure message.
5. Do not use `wait(fixedMs)` to wait for async effects. Poll a condition with a deadline,
   and fail with the observed state when the deadline passes.

## Scenarios

Implement the scenarios in this order. Each lists the load, the invariant, and the
failure it hunts.

### S1. Volume: single store, single collection

Load: 100k entities added in batches of 1k, each batch followed by `saveChangesAsync`.
Then 10k updates, 10k removals, in mixed batches (adds + updates + removes in one save).

Invariants:
- `countAsync` equals the bookkept expected count after every batch.
- A final `toArrayAsync` matches a plain JS `Map` oracle (id → entity) exactly.
- Save-report aggregates (`result.aggregate`) match the batch's intended change counts.

Hunts: silent drops in mixed saves, id collisions at volume, aggregate misreporting.
Run against: memory, file-system, sqlite. (Postgres in S8.)

### S2. Volume: wide schemas and deep nesting

Load: use the shape catalog's `object-depth-3`, `multi-mixed-modifiers`, and
`array-of-date` shapes. 10k entities each. Full lifecycle: add → read back → mutate a
nested/array property through the tracked proxy → save → read back.

Invariants:
- Nested and array mutations persist (read-back reflects the mutation).
- Dates stay `instanceof Date` after every read.
- No entity gains or loses properties across cycles (compare key sets against the oracle).

Hunts: codegen path bugs that only appear when enrich/serialize runs 10k times, proxy
wrapping regressions, date realm issues.

### S3. Churn: long-running mutation cycles

Load: 1k entities, then 10k cycles. Each cycle: query a random subset (~50), mutate one
scalar + one nested + one array property on each, save, occasionally remove and re-add.

Invariants:
- Oracle equality after every 500 cycles.
- `previewChangesAsync` reports zero pending changes after every save.
- RSS growth across the run stays under a linear bound (measure with
  `process.memoryUsage().rss` every 500 cycles; fail if the last third still grows at
  the same rate as the first third).

Hunts: change-tracker leaks (canonical attachments that never release), tracking-state
corruption after repeated pause/unpause, `__tracking__.changes` maps that only grow.

### S4. Concurrency: parallel saves in one store

Load: 20 async workers over one datastore. Each worker adds and mutates its own key
range, 200 saves per worker, no awaiting between workers.

Invariants:
- No save rejects.
- Final state equals the union of all worker oracles.
- No worker observes another worker's uncommitted mutation as its own pending change.

Hunts: TrampolinePipeline/WorkPipeline races, shared `request.queryOptions` corruption
(the snapshot/restore fix in `SelectionQueryable` is new — stress it), tag collection
cross-talk.

### S5. Concurrency: many stores, one database

Load: 10 stores created with the SAME database name (memory plugin, then file-system).
Each store adds/updates/removes in its own key range. Every store also holds one
subscribed query (`subscribe().toArray`).

Invariants:
- Final data equals the union of all stores' oracles.
- Every subscription eventually converges to the final row count (poll with deadline).
- After `destroyAsync` on all stores, the process exits without `--forceExit`
  (open BroadcastChannels hold the event loop — leaked channels are a failure).

Hunts: broadcast storms, subscription channel refcount bugs (`SchemaChannel.release`),
the auto-attach interactions that made the cross-context test racy.

### S6. Subscriptions and views under write pressure

Load: use `TestDataStore` from the memory plugin tests (it has `productsView`,
`productsHistory`, `commentsView`). 5k product saves in batches of 50.

Invariants:
- `productsView` count equals product count after convergence (poll with deadline).
- `productsHistory` only grows; a batch of N content-changing updates grows it by exactly N.
- Subscription callback count per subscriber is bounded: initial result + at most one
  notification per save that changed the view. More is over-notification.

Hunts: view derive feedback loops, notification amplification, the empty-send guard
regressing, history id churn (compute-once identity is new — stress it).

*As built:* `stress/src/s6-views-under-write-pressure.test.ts`, at the specified scale. Two
additions the spec could not have anticipated — an assertion that view reads are frozen (views
are `"immutable"` since defect #17), and one that each subscriber's last notification reflects the
settled data, without which the notification bound is vacuous. A no-op save is also asserted to
produce no notification at all, which is the empty-send guard stated directly.

### S7. Replication: OptimisticUpdatesDbPlugin under lag

Load: `OptimisticUpdatesDbPlugin` over a deliberately slow source plugin (wrap
MemoryPlugin, delay every `bulkPersist` callback 10–50ms randomly). 2k mixed saves,
queries interleaved between saves without waiting for mirrors.

Invariants:
- Every query reflects all acknowledged saves (read-your-writes).
- Removed entities never reappear, even while mirror writes are still in flight.
- After the run drains, source and read plugin hold identical data.

Hunts: re-hydration resurrection (fixed once — guard the fix), mirror-order bugs,
`writtenCollections` gaps for collections first touched by a query.

*As built:* `stress/src/s7-replication-under-lag.test.ts`, over `LaggingPlugin`
(`stress/src/harness/lagging-plugin.ts`), which is self-tested in `harness.test.ts`. It delays the
*callback*, not the operation — delaying the call would serialise work the real system runs
concurrently. The resurrection invariant is asserted in the only shape that can reach the
hydration branch: remove **every** row, then read. Anything smaller leaves the read plugin
non-empty and the branch untaken. See the yield note in the deviations above — without it the
scenario silently measured a stopped mirror rather than a lagging one.

### S8. Real databases

Gate behind `STRESS=1 E2E_CONTAINERS=1`. Run S1 (scaled to 10k) and S3 (scaled to 2k
cycles) against Postgres via testcontainers, and against sqlite on disk. Add one
Postgres-specific scenario: 5 plugin instances on one database, concurrent mixed saves,
oracle equality at the end.

Hunts: savepoint/transaction bugs under concurrency, pool exhaustion, the flattened
persist loop under real I/O.

*As built:* `stress/src/s8-real-databases.test.ts`, with the container lifecycle in
`stress/src/harness/postgres.ts` (deliberately **not** re-exported from `harness/index.ts`, so
testcontainers stays out of every other scenario's module graph). One container per file, reused
across scenarios, with isolation by collection name — a Postgres start is several seconds and
paying it per scenario would spend the budget on setup.

This is the scenario that paid for itself: the volume load passes, and the other four cases are
each pinned to a defect no in-process backend can see (#19–#22). Two deviations are recorded
above — no SQLite churn run, and an unverified budget for the Postgres churn scenario.

### S9. Throughput regression floor

The benchmark runner is broken (`npm run benchmark` fails at launch with
`ERR_REQUIRE_CYCLE_MODULE` — pre-existing, tsx/esm cycle in `benchmark/src/run.ts`).
Either fix that launcher or add a minimal floor check to `stress/`: measure inserts/sec
and reads/sec on the memory plugin at 10k entities, and fail if throughput drops below
half of the recorded baseline. Record the baseline in a JSON file next to the test on
first run.

## When a scenario fails

Follow the workflow in `specs/known-defects.md`:

1. Reduce the failure to the smallest deterministic reproduction (seed + scale).
2. Add an entry to `specs/known-defects.md` with symptom, location, and reproduction.
3. Pin it with `it.failing` in the closest functional suite — not only in `stress/`.
4. Fix it only if the fix is contained. Otherwise leave the pin and the entry.

## Gotchas that will mislead you

- **jest realm:** `structuredClone` inside jest returns foreign-realm Dates that fail
  `instanceof Date`. Assert with `Object.prototype.toString` or compare `getTime()`.
- **Queries fall back to in-memory filtering.** A broken SQL translator still returns
  correct rows through the fallback. Throughput collapse is the observable symptom.
- **MemoryPlugin databases are process-global by name** (`dbs` registry). Use
  `uuidv4()` database names unless the scenario shares a database on purpose.
- **Broadcast channels are scoped by schema + `IDbPlugin.identity`.** Stores share
  notifications only when their plugins report the same identity. An open channel keeps
  the event loop alive; `destroyAsync` every store you create.
- **Subscription messages sent before a subscriber exists are dropped** (timestamp
  guard). Create subscribers before the writes they must observe.
- **`attachments.set` adopts the given instance** as the canonical attachment. Do not
  assert converge-on-first semantics.
- **Do not "fix" these known-open gaps** if a scenario trips on them; report instead:
  `SchemaTypes.Definition` as generic primitive, renamed key properties, Dates inside
  object elements of arrays, identity objects.
- **Constructing a DataStore opens a BroadcastChannel pair per collection**, whether or not
  anything subscribes — two `MessagePort` handles that hold the Node event loop open. Dispose
  every store a scenario opens (`destroy` now does it too). This is what made runs need
  `--forceExit`; they no longer do, and a scenario that leaks will bring it back.
- **Routier's logger used to be ON in every Jest run — this is now FIXED**, and the fix is worth
  knowing about because it changes how you debug a scenario. `shouldLog()` returned true whenever
  `NODE_ENV` was `test`, which Jest always sets, and nothing could switch it off:
  `globalThis.__ROUTIER_DEBUG__` was only ever compared against `true`, so the `= false` that
  `docs/how-to/debug-logging.md` documented did nothing. `OptimisticUpdatesDbPlugin` logs three
  debug lines per query, so S7 spent more wall clock on console records than on saving — **12.4s
  with logging, ~6s without** — and the seed-and-scale banner was buried under the output.
  The logger now has real levels and defaults to `silent`. To see plugin logging while working on
  a scenario: `ROUTIER_LOG_LEVEL=debug STRESS=1 npx jest --selectProjects stress -t 'S7'`.
  Measured cost of the gate: an emitted call ~70ns, a suppressed one ~3ns, of which building the
  payload object is ~0.2ns — which is why the logger kept its eager signature instead of taking
  a thunk.
- **Views hand back frozen objects.** `View.changeTrackingType` is `"immutable"`, so since
  defect #17 was fixed anything read from a view is frozen and a write to it throws under a
  module's strict mode. Snapshot before annotating.

## Acceptance criteria

1. `npx jest` (default run) is unchanged and green, and exits without `--forceExit`.
2. `STRESS=1 npx jest --selectProjects stress` runs S1–S7 and S9–S11 in under 30 minutes.
3. `STRESS=1 E2E_CONTAINERS=1 npx jest --selectProjects stress` adds S8 (requires Docker).
4. Every scenario prints its seed and scale on failure.
5. Every defect found has a reproduction, a `known-defects.md` entry, and a pin.

## Commands

```
npx jest                                          # functional suite, must stay green
NODE_OPTIONS=--expose-gc STRESS=1 npx jest --selectProjects stress   # S1–S7, S9–S11
STRESS=1 E2E_CONTAINERS=1 npx jest --selectProjects stress   # + S8, needs Docker
```

Neither needs `--forceExit`. If one starts to, a store somewhere is not being disposed —
run the suspect test files one at a time and see which never exits.
