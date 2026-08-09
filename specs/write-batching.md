# Write batching

Date: 2026-08-08. Not built. Open questions are stated rather than assumed.

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

Partition the drained batch into groups. An item joins a group only if none of its schemas is
already claimed there; otherwise it starts a new one. Groups are written in order.

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
        mine.set(schemaId, result.get(schemaId));
    }

    item.done(PluginEventResult.success(result.id, mine));
}
```

No counting, no slicing, no assumption about echo order, and nothing to verify afterwards. The
part of the original design that needed a safety valve — because being wrong was silent — is
simply not present.

### What is left: problem 3

Coupled failure is real and does not go away. **Try the batch; if it fails, re-run its items
individually, in order.** The happy path stays one round trip, the failure path is exactly today's
behaviour, and no caller ends up worse off than not batching. The cost is N+1 writes for a failing
batch of N, paid only when something is already going wrong.

That is also what makes it compose with optimistic concurrency, which would otherwise break it:
`ConcurrencyDbPlugin` fails a save whose token is stale, and without the fallback one writer
losing a race would abort unrelated writers in the same batch. With it, the retry sorts them out
and only the actual loser sees `OptimisticConcurrencyError`.

### How well it works on the real case

The batch that actually forms is the views, and a view is one schema each — so a store with three
views produces three items over three distinct schemas, which merge into one write. Exactly the
case worth having.

What it cannot collapse is the caller's save together with its views, and no version of this can.
A view recomputes from a subscription that fires in `afterPersist`, after the caller's write has
already returned, so by the time a view has anything to write the queue is empty. **Four round
trips become two, not one.**

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

        // Usually one group. Two only when two writers touched the same collection, which is
        // exactly when they must not be merged.
        const groups = partitionByDisjointSchemas(batch);

        this.writeGroups(groups, () => this.drain());
    }
}
```

A single-item group passes through untouched — no merge, no split. That is most writes, and it
means the uncontended path never reaches the machinery at all.

## What still has to be decided

1. **Whether to build it**, on a measurement rather than on the shape being appealing.
2. **Failure policy** — retry individually is the recommendation, and is what makes optimistic
   concurrency survive.
3. **Batch size ceiling.** A thousand queued writes in one transaction is a very large statement
   set and some engines cap it — D1's `batch()` in particular. A ceiling means the drain takes N
   rather than all, which changes none of the reasoning.
4. **Whether to batch across stores** or only within one. Cross-store is where it helps most and
   where the coupled-failure blast radius is widest; the fallback largely answers it.

## Whether it is worth building

Not yet, on the evidence available.

Nothing measured says round trips are hurting anyone: saves run about 0.5ms against a local SQLite
file and 1.6ms against PostgreSQL in a container. The payoff is real but bounded — four writes
become two — against a merge-and-split path plus a failure-retry path.

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
  one fails, and the error reaches the right caller.
- **Concurrency composition.** `ConcurrencyDbPlugin` above `BatchingDbPlugin`, two writers racing
  one row. Exactly one gets `OptimisticConcurrencyError` and nobody else is affected.
- **That it actually batches.** Count `bulkPersist` calls on the inner plugin — N concurrent saves
  must produce fewer than N. Without this the suite passes just as happily with a wrapper that
  queues and never merges.
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
