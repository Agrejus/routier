# Stress-testing spec

Status: **Partially implemented** — S1, S2, S3, S4, S9 built and green; S5–S8 not started
Date: 2026-08-02
Audience: an agent with no prior context on this repository.

## Implementation status (2026-08-02)

`STRESS=1 npx jest --selectProjects stress --forceExit` — 35 tests, ~93s.

| Scenario | State | Notes |
| --- | --- | --- |
| S1 volume, single collection | Done | memory 100k, file-system 5k, sqlite 20k — see the budget note below |
| S2 wide schemas / deep nesting | Done | 2 of 8 cases pinned to defects #12 and #13 |
| S3 churn | Done | 10k cycles, ~93s, no leak detected |
| S4 concurrency, one store | Done | 20 workers x 200 saves, no race found |
| S5 many stores, one database | **Not started** | |
| S6 subscriptions and views | **Not started** | |
| S7 replication under lag | **Not started** | |
| S8 real databases | **Not started** | |
| S9 throughput floor | Done | baseline in `stress/src/throughput-baseline.json` |

**Defects found so far** (all recorded in `specs/known-defects.md`, all reducible to a
handful of entities once found):

- **#11 — a persisted entity never went clean. FIXED.** Update counts climbed save over
  save, `previewChanges` never reached zero, and a removed row was resurrected by any
  later unrelated save.
- **#12 — arrays stop being change-tracked after the entity's first merge. OPEN, pinned.**
  Silent data loss on in-place array writes.
- **#13 — saving a mutation two or more levels deep throws. OPEN, pinned.** The delta is a
  flat dotted-path map, and the delta serializer walks it as if it were an entity.

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
- *`--forceExit` is required.* Leaked handles keep Jest alive after the run completes;
  without it a passing run looks like a hang. Making this a tested invariant is S5's job.

## Goal

Find defects that the functional suite cannot see: data loss under volume, races under
concurrency, unbounded memory growth, and throughput collapse. The functional suite
(5,364 tests) is green and stable. All 14 defects in `specs/known-defects.md` are fixed.
Do not re-test single-operation correctness — stress the system until it breaks, then
pin what broke.

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

### S8. Real databases

Gate behind `STRESS=1 E2E_CONTAINERS=1`. Run S1 (scaled to 10k) and S3 (scaled to 2k
cycles) against Postgres via testcontainers, and against sqlite on disk. Add one
Postgres-specific scenario: 5 plugin instances on one database, concurrent mixed saves,
oracle equality at the end.

Hunts: savepoint/transaction bugs under concurrency, pool exhaustion, the flattened
persist loop under real I/O.

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
- Single-file jest runs often need `--forceExit` today. S5 is the scenario that makes
  leaked handles a tested invariant instead.

## Acceptance criteria

1. `npx jest` (default run) is unchanged and green.
2. `STRESS=1 npx jest --selectProjects stress` runs S1–S7 and S9 in under 30 minutes.
3. `STRESS=1 E2E_CONTAINERS=1 npx jest --selectProjects stress` adds S8 (requires Docker).
4. Every scenario prints its seed and scale on failure.
5. Every defect found has a reproduction, a `known-defects.md` entry, and a pin.

## Commands

```
npx jest                                          # functional suite, must stay green
STRESS=1 npx jest --selectProjects stress         # stress scenarios S1–S7, S9
STRESS=1 E2E_CONTAINERS=1 npx jest --selectProjects stress   # + S8, needs Docker
```
