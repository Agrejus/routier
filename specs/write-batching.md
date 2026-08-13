# Write batching

Date: 2026-08-08, built 2026-08-10. `core/src/plugins/BatchingDbPlugin.ts`.
Open questions are stated rather than assumed.

## The problem

A store writes to its backend from more than one place, and those writes overlap.

A `saveChanges` is one write. Every view then reconciles in response to it — reading its own
contents, diffing, and writing — which is one more write per view. An audited collection adds its
rows to the caller's save rather than writing separately, so that one is already free, but views
are not. A store with three views issues four writes per logical change, none of them coordinated
with the others.

That produced two distinct failures, and it is worth keeping them apart because only one of them
is fixed.

### Failure one: they collided. Fixed.

SQLite has a single write lock per database. Two of those four writes arriving together meant the
second got `database is locked` rather than waiting — and for a view that failure is only logged,
so the view was left silently stale with nothing to tell anyone.

Fixed in `SqliteDbPlugin`, which serializes its own writes. The route there is worth recording,
because the first attempt was wrong in an instructive way. A queue in the DATASTORE, shared by
every write, also fixed it — and cost this:

|                     | no queue  | datastore queue | plugin queue |
| ------------------- | --------- | --------------- | ------------ |
| postgres sequential | 80ms      | 80ms            | 79ms         |
| postgres concurrent | 17ms      | **76ms**        | 17ms         |
| sqlite sequential   | 25ms      | 28ms            | 26ms         |
| sqlite concurrent   | **FAILS** | 31ms            | 29ms         |

Sequential saves — the common case — cost nothing either way, because a queue with nothing in it
runs immediately. But serializing in the datastore charged PostgreSQL 4.5x on concurrent writes
for a lock it does not have. Serialization is a fact about an engine, so it belongs in the plugin
with the constraint; PostgreSQL, MySQL and MongoDB keep their concurrency untouched.

### Failure two: there are still four of them. Not fixed.

Correctness is settled; the round trips are not. Four writes where one logical change happened is
four transactions and four network waits. On a local file that is invisible. On a client-server
database the round trip dominates everything else a save does.

**This document is about failure two, and only failure two.** Nothing here is needed for
correctness.

## The proposed solution

One queue in front of `bulkPersist`:

- A write arrives. Push it onto the queue.
- If a write is already in flight, **do nothing else**. The one running will take it.
- Otherwise drain: take *everything* waiting, and write it in one go.
- When that returns, call the drain again. Anything that arrived while it ran goes out as the
  next batch — immediately, not on a timer.

Nothing polls, nothing sleeps, nothing waits for a batch to fill.

**The property that makes it safe is that it never waits.** A batch is only what already arrived.
When writes do not overlap the queue is empty, the drain runs immediately, and the batch is one
item — byte for byte what happens today. Latency cannot increase. Throughput improves exactly
when there is contention to improve.

That is the opposite trade to serializing, which paid a measured cost to gain safety on one
engine. This pays no latency at all. The shape is right; what follows is where the naive version
of "write it in one go" breaks, and how to keep the shape without it.

## Where it falls short

### 1. Merging reorders operations, and silently loses writes

A plugin applies operations **removes, then updates, then adds, within a schema** — see
`SqliteDbPlugin.persist`, and the same grouping in the PostgreSQL and MySQL plugins. That is
correct for one save, where the three sets are independent of each other.

Merge two saves into one `SchemaPersistChanges` and their operations are regrouped, so the order
BETWEEN them is gone:

    save A:  add row X
    save B:  update row X

    sequential:  X is added, then updated   ->  X holds B's values
    merged:      updates run first (X does not exist yet, affecting nothing),
                 then adds                   ->  X holds A's values

B's update is lost. Nothing errors, no row count looks wrong, and the caller is told their save
succeeded. Add-then-remove is the same shape: the remove runs against a row that is not there
yet, and the row survives a deletion that was asked for.

### 2. One result has to become several

A caller's `bulkPersist` returns a `BulkPersistResult`, and the change tracker uses it to pair
each echoed row with the addition it sent — that is how a database-assigned identity gets back
onto the entity. Merge three callers and one result comes back for all three.

Splitting it by recording each item's contribution and slicing by position works only while
plugins echo rows in submission order. That assumption is already load-bearing elsewhere, but
here being wrong is silent: caller A receives caller B's rows, and their entities end up carrying
another store's identities.

### 3. One transaction covers several callers

A merged write is one transaction. If one item fails everything rolls back, so a caller's save can
fail because of somebody else's data.

## The version that works

Problems 1 and 2 have the same cause: **items in a batch that touch the same schema**. Remove that
and both disappear, rather than being mitigated.

> **Drain everything, then merge only items whose schemas do not overlap. Items that share a
> schema go in separate writes, in arrival order.**

Partition the drained batch into groups, **append-only**: an item joins the LAST group if none
of its schemas is claimed there; otherwise it closes that group and starts a new one. Groups are
written in order.

Append-only, not first-fit. First-fit — scan every open group for one the item fits — merges
more, and reorders doing it: with arrivals A(schema S), B(schema S), C(schema T), first-fit puts
C into A's group, writing C before the earlier-arrived B. No shared schema, so nothing is lost
within a table — but global arrival order is gone, and a caller who saved B before C can observe
C land first. The last-group rule preserves arrival order unconditionally — everything in group
N arrived before everything in group N+1 — and on the case that matters, three views over three
distinct schemas, the two rules produce the identical single group.

### Why problem 1 disappears

Two items in a group never share a schema, so the plugin's removes-then-updates-then-adds
grouping only ever reorders operations **within a single item** — which is exactly what it does
for an unbatched save today, and is correct. There is no cross-item ordering left to lose.

Two items that DO touch the same schema are never merged, so their order is preserved by being
written separately. That is not a compromise: two writes to one table genuinely are ordered, and
the design now says so.

### Why problem 2 disappears

Disjoint schemas mean each schema in a merged write came from exactly one item, so the result
splits **by schema** rather than by position:

```ts
for (const item of group) {
    const mine = new BulkPersistResult();

    for (const schemaId of item.schemas) {
        // A schema the plugin had nothing to echo for gets an empty result, never a hole.
        mine.set(schemaId, result.get(schemaId) ?? new SchemaPersistResult());
    }

    // Answered under ITS OWN event id — the merged write ran under a synthetic id no
    // caller has ever seen, and nothing upstream may be handed it.
    item.done(PluginEventResult.success(item.event.id, mine));
}
```

No counting, no slicing, no assumption about echo order, and nothing to verify afterwards. The
part of the original design that needed a safety valve — because being wrong was silent — is
simply not present.

The merged event is synthetic throughout: its own id, its operation the union of the items'
operations, and its `schemas` the union of their `SchemaCollection`s — a plugin resolving
`event.schemas.get(schemaId)` must find every schema any item brought.

### What is left: problem 3

Coupled failure is real and does not go away. **Try the batch; if it fails, re-run its items
individually, in order.** The happy path stays one round trip, the failure path is exactly today's
behaviour, and no caller ends up worse off than not batching. The cost is N+1 writes for a failing
batch of N, paid only when something is already going wrong.

The fallback is only correct when the inner plugin's `bulkPersist` is ALL-OR-NOTHING. Retry a
half-applied batch individually and the items that already landed apply twice — duplicate adds
under fresh identities, and nothing errors.

SQLite, PostgreSQL and MySQL are atomic — one transaction, rolled back entire on failure
(PostgreSQL's savepoints are create-table recovery, not partial commit). `EphemeralDataPlugin` is
atomic against FAILURE and says so: it phases the save so every collection validates before
anything applies, and reverts through an undo log if any collection fails. What it cannot cover
is a CRASH between two file writes, which needs a journal a memory-first plugin does not pretend
to have. A crash also kills the batching wrapper, so the retry fallback never runs after one —
which means the pure-memory plugin could defensibly declare itself atomic. It should not: the
file-backed plugins inherit that same `bulkPersist`, and atomicity is a property of a concrete
plugin, not of a family.

So merging is opt-in, and the caller states the promise — see "Turning merging on". Left off,
the wrapper still gets the queue; its batches are just always of one, which is exactly today's
behaviour.

That is also what makes it compose with optimistic concurrency, which would otherwise break it:
`ConcurrencyDbPlugin` fails a save whose token is stale, and without the fallback one writer
losing a race would abort unrelated writers in the same batch. With it, the retry sorts them out
and only the actual loser sees `OptimisticConcurrencyError`.

### How well it works on the real case

The batch that actually forms is the views, and a view is one schema each — so a store with three
views produces three items over three distinct schemas.

They do not all merge, and the reason is the property that makes this wrapper free. **The first
write never waits.** It arrives to an empty queue, drains immediately, and goes out alone; only
the writes that arrive WHILE it is in flight can join a batch. So three views are two round trips
— the first alone, the other two merged — not one. Building it made this concrete: the test
asserting "three concurrent writes collapse to one" failed, correctly, at two.

Adding the caller's own save, which cannot merge with its views under any version of this — a
view recomputes from a subscription that fires in `afterPersist`, after the caller's write has
already returned, so the queue is empty by the time a view has anything to write:

| | writes |
| --- | --- |
| today | 4 — caller, then one per view |
| batched | 3 — caller, first view, then the remaining two merged |
| views contributing to the caller's save | 1 |

**Four round trips become three.** An earlier draft of this document claimed two; that was wrong,
and it was wrong by exactly the first-write-goes-alone rule stated two paragraphs up. The gap
widens with view count — six views would be 7 → 3 — so the ratio is better for stores that have
more of them, and thinnest for the three-view store used as the example throughout.

Getting to one means views contributing to the same `BulkPersistChanges` as the save that triggers
them, the way audit rows already do. That needs a view to know what changed without reading the
result of the save — the incremental-`derive` question, and a separate piece of work.

## Sketch

```ts
class BatchingDbPlugin implements IDbPlugin {
    private readonly queue: QueuedWrite[] = [];
    private isWriting = false;

    bulkPersist(event, done) {
        this.queue.push({ event, done });

        // In flight: the completion below takes this. Doing anything else here is what turns a
        // queue into a race.
        if (this.isWriting) {
            return;
        }

        this.drain();
    }

    private drain() {
        const batch = this.queue.splice(0);      // everything waiting, not one item

        if (batch.length === 0) {
            this.isWriting = false;
            return;
        }

        this.isWriting = true;

        // The continuation is the latch's only way down, so it MUST run — after success,
        // after failure, after a caller's `done` throwing. An exception that escapes
        // leaves `isWriting` stuck true and every future write queues forever: a total,
        // silent write outage. Everything below reaches `next` on every path.
        const next = () => this.drain();

        let groups: PreparedGroup[];

        try {
            // PREPARE is pure and happens before any write is issued: the append-only
            // partition AND every synthetic merged event (fresh id, union of operations,
            // union of SchemaCollections). Usually one group — two only when two writers
            // touched the same collection, which is exactly when they must not be merged.
            groups = prepare(batch);
        } catch (error) {
            // A throw here is a bug in this wrapper, not a backend failure, and NOTHING
            // has been written yet. Degrade to what no-batching does: each item straight
            // through, in arrival order.
            this.writeIndividually(batch, next);
            return;
        }

        // `writeGroups` answers each caller inside its own try/catch — one caller's
        // throwing `done` must not eat its batchmates' results — and is `finally`-shaped.
        this.writeGroups(groups, next);
    }

    /** done() guarded: a throwing callback costs its own caller, nobody else. */
    private answer(item: QueuedWrite, result: PluginEventPartialResultType<BulkPersistResult>) {
        try { item.done(result); } catch (error) { /* logged; nobody left to tell */ }
    }
}
```

A single-item group passes through untouched — no merge, no split. That is most writes, and it
means the uncontended path never reaches the machinery at all.

### The guard covers prepare, and only prepare

It is tempting to wrap the whole drain, `writeGroups` included. That is wrong, and dangerously so:
if group 1 has already landed and group 2 throws, a catch that re-runs the batch individually
double-applies group 1 — the exact hazard the atomicity gate exists to prevent. Building every
merged event during PREPARE is what makes "nothing has been written yet" true by construction at
the catch site. Past that line, failure is the inner plugin's, and the retry-individually fallback
already owns it.

Degrading to individual writes, rather than answering everyone with the error, is the choice
worth stating. Failing them all is simpler and needs no fallback path, but it converts an internal
optimizer bug into N failed saves whose data was perfectly writable, and it needs a "we never
tried" error vocabulary that does not exist. Degrading reuses machinery the failure policy already
mandates, and its worst case is exactly today's behaviour. Only if the pass-through ITSELF throws
synchronously does a caller see an error — under its own `event.id`, never the synthetic one.

### Shutdown

`destroy` is the only teardown verb `IDbPlugin` has (`core/src/plugins/types.ts`), and it is
destructive rather than graceful: `SqliteDbPlugin.destroy` calls `driver.deleteDatabase`,
`RetryDbPlugin` declines to retry it because it is irreversible, and `DataStore.destroy` forwards
straight to it. There is no flush or close. That settles the policy, because draining into a
database that is about to be deleted spends round trips producing state the next call destroys —
and the drain loop refills, so teardown latency is unbounded.

**Reject pending, deliver in-flight.** Close the queue; fail every QUEUED item with
`PluginDestroyedError` under its own event id, through the same guarded `answer`; let the
IN-FLIGHT write settle and hand its callers their real results, since destroying cannot un-send
it; then forward `destroy` to the inner plugin. Forwarding must wait for that settle —
`deleteDatabase` racing an open transaction on another connection is its own failure.

A write arriving after close fails immediately and never reaches the inner plugin. Passing it
through would be more transparent, but SQLite's create-table-and-retry path would happily
RECREATE the database that was just deleted and report success against an empty file; and the
queue's contract — every accepted write is eventually answered by a live drain loop — cannot be
honoured once the loop is gone. `PluginDestroyedError` belongs in `core/src/errors` beside
`OptimisticConcurrencyError`, so callers can tell shutdown from a backend fault.

If a non-destructive `close()` is ever added to `IDbPlugin`, drain-then-close is the right
behaviour FOR THAT VERB. It is not the right behaviour for this one.

## What still has to be decided

1. ~~**Whether to build it**, on a measurement rather than on the shape being appealing.~~
   Built on 2026-08-10 without that measurement, which remains the honest gate on whether to
   TURN IT ON: nothing measured says round trips are hurting anyone. Off by default, so the
   decision is per-caller rather than repository-wide.
2. **Failure policy** — retry individually is the recommendation, and is what makes optimistic
   concurrency survive.
3. **Batch size ceiling.** A thousand queued writes in one transaction is a very large statement
   set and some engines cap it — D1's `batch()` in particular. A ceiling means the drain takes N
   rather than all, which changes none of the reasoning.
4. **Whether to batch across stores** or only within one. Cross-store is where it helps most and
   where the coupled-failure blast radius is widest; the fallback largely answers it. Note the
   wrapper only merges what shares an INSTANCE: a store's views already write through the
   datastore's own plugin, but cross-store means the stores sharing one `BatchingDbPlugin` —
   with per-store wrappers stacked above the shared batcher, never below it.
   `ConcurrencyDbPlugin` holds per-store observed versions, so a shared batcher under separate
   concurrency wrappers is the only stacking that works.
5. **Where it lives — recommended: a core wrapper plugin.** `BatchingDbPlugin` in
   `core/src/plugins` beside `ConcurrencyDbPlugin`, opted into by wrapping, not baked into
   each plugin or the datastore. Serializing already taught the placement lesson: a datastore
   queue charged PostgreSQL 4.5x for SQLite's lock. Batching is the mirror image — merging is a
   CALLER'S tolerance for coupled transactions, not an engine fact, so it composes above the
   engine. And it is not for everyone: the ephemeral plugins cannot merge (not atomic, so the
   fallback double-applies), the local-file plugins gain nothing (no round trip worth saving);
   the client-server plugins are the audience.

## Turning merging on

Merging is an option on the wrapper, off by default:

```ts
new BatchingDbPlugin(plugin);                                          // queues, never merges
new BatchingDbPlugin(new PostgresDbPlugin(conn), { isAtomic: true });  // merges
```

```ts
export class BatchingDbPlugin implements IDbPlugin {
    constructor(
        private readonly inner: IDbPlugin,
        private readonly options: { isAtomic?: boolean } = {}
    ) { }

    private get canMerge() {
        return this.options.isAtomic === true;
    }
}
```

`isAtomic` is the caller promising that a failed save beneath this wrapper leaves NOTHING
applied — the precondition the retry-individually fallback needs. Omitted, the wrapper still
queues and serializes; it just writes batches of one, which is today's behaviour.

The caller asserting this is worth being uneasy about, since a wrong promise is a silent
double-apply rather than an error. Two things make it acceptable: it is off by default, so
silence is safe and the dangerous state is only ever reached deliberately; and the option is
named after the promise rather than after the speedup, so what is being claimed is visible at
the call site rather than buried in a changelog.

### What this replaces

Earlier drafts grew a `composition` block on `IDbPlugin` — `innermost`, `perStore`, `rejects`,
an atomicity flag — plus a `composeDbPlugins` fold that validated the assembled chain and
refused violations. That is gone, for two reasons.

`IDbPlugin` is frozen at `databaseName`, `query`, `destroy`, `bulkPersist`
(`specs/domains.md`, `specs/plugin-database-name.md`). Composition metadata is advice to a
composer, not part of what a plugin IS, so it has no claim on the contract. The variants that
kept the contract clean — a static on the engine class read through a cast, a registry keyed by
constructor, wrapper descriptors carrying constraints — each moved the complexity somewhere else
without removing it, and all of them made `BatchingDbPlugin` know something about engines.

It does not need to know. It needs one bit, and the caller has it.

Ordering across wrappers is a real problem and it is NOT this one: retry, cache and concurrency
can already be stacked wrongly today, with no batching involved. It deserves its own treatment
rather than riding in on a feature that merely reminded everyone it exists — carried out to
`specs/plugin-roadmap.md`, "Wrapper stacking order", with the specific pairs written down.

## Whether it is worth building

Not yet, on the evidence available.

Nothing measured says round trips are hurting anyone: saves run about 0.5ms against a local SQLite
file and 1.6ms against PostgreSQL in a container. The payoff is real but bounded — four writes
become two — against a merge-and-split path plus a failure-retry path.

### What the prototype measured

A faithful prototype of the sketch — queue, append-only partition, schema-keyed split,
retry-individually fallback, finally-shaped latch — ran against mock backends on 2026-08-08.
Sixteen assertions covering the whole test plan above passed, and the numbers came out:

|                                                  | result                                            |
| ------------------------------------------------ | ------------------------------------------------- |
| wrapper overhead, uncontended sequential saves   | ~260ns per save — 0.05% of a 0.5ms SQLite save    |
| lone save against a 2ms round trip               | 2.48ms direct, 2.48ms batched — identical         |
| 40 concurrent saves, serialized backend, 2ms/trip | 98.8ms / 40 trips unbatched → 5.4ms / 2 trips (18x) |
| partition cost at a batch of 1000                | 70µs — three orders of magnitude under one trip   |

The 18x is the mechanism's ceiling under saturation, not a forecast — the batch that actually
forms is a store's views, so the realistic gain is four-trips-become-three (see "How well it
works on the real case"; the prototype's own numbers did not settle this, and the built version's
tests did). What the numbers
settle is the design's two claims: the uncontended path pays nothing measurable, and a lone save
is not delayed by a single tick. What they cannot settle is whether round trips hurt anyone in
production, which is still the gate.

**The measurement that decides it** is write round trips per logical change under a realistic load
against a server backend, where the trip is large enough to dominate. If a store with views is
spending meaningful time waiting on writes, this design is ready and the dangerous parts have been
designed out. If it is not, the ratio does not justify the machinery.

Worth separating out: the reordering hazard exists because plugins group by operation type rather
than preserving submission order. The disjoint-schema rule works around it. Removing it at the
source would make merging unconditionally safe, and is worth considering on its own merits.

## How it would be tested

`describePluginContract` against `BatchingDbPlugin` over the memory plugin first — proving
batching did not change what a backend does, the same check the retry and cache wrappers run.

Then the parts a contract cannot see:

- **Attribution.** Several stores over one plugin, each adding rows with database-assigned
  identities, saving concurrently. Every store gets back exactly its own rows with its own
  identities.
- **The disjoint rule.** Two writers to the SAME schema, one adding a row and the other updating
  it. They must not merge, and the update must survive. This is the case that silently loses data
  if the partition is wrong.
- **Failure fallback.** A batch containing one write that cannot succeed: the others land, that
  one fails, and the error reaches the right caller. This one runs against an ATOMIC inner
  plugin (sqlite), not memory — over a non-atomic inner the retry double-applies whatever
  half-landed, which is the hazard the atomicity gate rules out, not a behaviour to test around.
- **Arrival order across groups.** Writers A then B to one schema, then C to another. C may
  merge with B, but must never be written before B — the append-only partition, not first-fit.
- **The latch survives failure.** A save that fails — an inner error, and separately a caller's
  `done` that throws — followed by another save. The second save must reach the inner plugin.
  A stuck `isWriting` is a permanent, silent write outage, and nothing else in the suite would
  notice it.
- **Concurrency composition.** `ConcurrencyDbPlugin` above `BatchingDbPlugin`, two writers racing
  one row. Exactly one gets `OptimisticConcurrencyError` and nobody else is affected.
- **That it actually batches.** Count `bulkPersist` calls on the inner plugin — N concurrent saves
  must produce fewer than N. Without this the suite passes just as happily with a wrapper that
  queues and never merges.
- **Off by default means batches of one.** `new BatchingDbPlugin(inner)` with no options, N
  concurrent saves: all succeed, and the inner `bulkPersist` count is exactly N. This is the only
  test that can tell "merging is off" from "the option is quietly ignored", and the default is
  the setting almost every caller will run.
- **Destroy answers the queue.** A slow in-flight write with three saves queued behind it, then
  destroy. The in-flight callers get their real results, every queued caller gets
  `PluginDestroyedError` under its own event id, and the inner `destroy` runs only after the
  in-flight write settles. Nothing else in the suite destroys with a non-empty queue, so a
  stranded `done` — a promise that never resolves — passes everything and hangs a real shutdown.
- **A write after destroy fails fast.** One more save after destroy resolves: the caller gets
  `PluginDestroyedError` and the inner `bulkPersist` is never reached. Without it, a post-shutdown
  write can recreate the database the destroy just deleted and no assertion would notice the
  resurrected empty file.
- **Partition failure answers everyone and frees the latch.** Force `prepare` to throw, then save
  again. Every caller in the failed batch receives a result, and the later save reaches the inner
  plugin. The latch bullet above covers inner errors and throwing `done`s, but not a throw in the
  wrapper's own synchronous prologue — the one region where the earlier sketch stranded it.
- **That it never delays.** A single save with an empty queue reaches the inner plugin in the same
  tick. The datastore's save path is synchronous up to the plugin on purpose, and a deferral there
  reintroduces a recorded defect where saves interleaved and the change tracker could no longer
  match an addition to its echo.

## See also

- `plugins/sqlite/src/plugin.ts` — serializing writes for the engine that needs it, and the
  measurements that put it there rather than in the datastore
- `datastore/src/views/View.ts` — why a store writes more than once per change
- `specs/plugin-roadmap.md` — the four shapes, and the audit log riding the caller's save, which
  is what views would have to do to collapse the last round trip
- `core/src/plugins/ConcurrencyDbPlugin.ts` — the composition the failure policy has to survive
