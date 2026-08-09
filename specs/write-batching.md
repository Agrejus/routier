# Write batching

A design for collapsing writes that are already waiting into one round trip, without delaying
any of them.

Date: 2026-08-08. Not built. Open questions are stated rather than assumed.

## The idea

One queue in front of a plugin's `bulkPersist`.

- A write arrives. Push it onto the queue.
- If a write is already in flight, **do nothing else**. The one running will take it.
- Otherwise drain: take *everything* on the queue, merge it into one set of changes, and issue
  one `bulkPersist`.
- When that returns, call the drain again. If anything arrived while it was running, it goes out
  as the next batch — immediately, not on a timer.

Nothing polls, nothing sleeps, and nothing waits for a batch to fill.

## Why it is worth doing

Because a store already writes more than once per logical change.

A `saveChanges` on a store with three views is four writes today: the caller's, then each view
reconciling in response to it. Every one is a separate transaction and a separate round trip. On
a local file that is cheap; on a server it is four network waits, and on a client-server database
the round trip dominates everything else the save does.

Batching turns that into one.

**The property that makes it safe is that it never waits for anything.** A batch is whatever
happens to have arrived while the previous write was in flight. When writes do not overlap the
queue is empty, the drain runs immediately, and the batch is one item — identical to today. So
latency never increases. Throughput improves exactly when there is contention to improve, which
is the only time anyone is measuring.

This is the opposite trade to serializing writes, which was measured at roughly four times
slower for concurrent writes on PostgreSQL (see `plugins/sqlite/src/plugin.ts` and the numbers
recorded with it). Serializing pays a cost to gain safety on one engine. Batching pays nothing
and gains throughput on every engine.

## What it is not

**Not a fix for SQLite's write lock.** That is already handled, in `SqliteDbPlugin`, by
serializing that plugin's own writes — the lock is a fact about that engine and the fix belongs
where the constraint is. Batching would reduce how often that queue is contended, but it is not
what makes it correct.

**Not a debounce.** No timer, no window, no "wait 5ms for more". A write is issued the instant
the backend is free. Adding a delay would trade latency for batch size and is a different
feature with a different argument behind it.

## Shape: a wrapper plugin

```ts
const store = new MyStore(new BatchingDbPlugin(new PostgresDbPlugin(config)));
```

It intercepts a save and applies to the whole store, which by `specs/plugin-roadmap.md`'s rule
makes it a wrapper rather than a collection declaration. That also means:

- every backend gets it, and none of them has to know
- it is opt-in, so a caller who does not want merged transactions does not get them
- no change to the datastore, which does not have to learn what a batch is

`query` and `destroy` pass straight through. Only `bulkPersist` is queued.

## The two hard parts

Everything above is easy. These are not, and they are why this is a design document rather than
a patch.

### 1. Giving each caller back its own result

A caller's `bulkPersist` returns a `BulkPersistResult`, and the change tracker uses it to pair
each echoed row with the addition it sent — that is how a database-assigned identity gets back
onto the entity. Merge three callers' changes into one write and one result comes back for all
three. Hand the whole thing to each of them and every one reports rows it never sent.

The result has to be split back apart, and the split has to be exactly right. Getting it wrong
does not throw: caller A silently receives caller B's rows, and their entities end up carrying
another store's identities.

**Approach.** Record, per queued item and per schema, how many adds, updates and removes it
contributed. The merged changes are built in queue order, so each schema's result arrays are in
that order too, and each item's slice is its recorded count taken in turn.

This relies on a plugin echoing rows in the order it received them. That assumption is already
load-bearing elsewhere — `AuditRegistry.detach` removes its own appended rows by position, and
the SQL plugins push `RETURNING` rows in statement order — so batching does not introduce it. It
does raise the cost of it being wrong.

**The safety valve, and it is not optional.** After the write, check that each schema's result
arrays are the length the recorded counts predict. If they are not, the plugin did not echo the
way this assumed, and the batch **fails every item in it** rather than distributing rows by a
rule that has just been shown to be false. A batch that cannot be attributed is not a batch that
can be partially believed.

Worth stating plainly: this check is what makes the whole design defensible. Without it, the
failure mode is silent cross-contamination of entity identities, which is close to the worst
thing a data library can do.

### 2. One transaction, several callers

A merged write is one transaction on any backend that has them. If one item in the batch fails,
the whole thing rolls back — so a caller's save can fail because of somebody else's data, and a
view's reconciliation failing could roll back the save that triggered it.

Three ways to answer it:

**(a) Accept and document.** Batched saves share a fate. Simple, and wrong for anyone who
batches a background job alongside interactive writes.

**(b) Batch only within an origin.** Merge a store's own writes but never across stores. Keeps
blast radius inside one caller's work, and still collapses the save-plus-views case, which is
the one worth having. Needs an origin on the event; `DbPluginEvent.source` exists but is
descriptive text rather than an identity.

**(c) Fall back on failure.** Try the batch. If it fails, re-run its items **individually**, in
order, so each gets its own transaction and its own outcome. The failing one fails; the rest
succeed.

**(c) is the recommendation.** The happy path stays one round trip and the failure path is
exactly today's behaviour, so no caller can be worse off than not batching. The cost is that a
failing batch of N does N+1 writes — paid only when something is already going wrong.

It composes correctly with optimistic concurrency, which is what makes it worth the complexity:
`ConcurrencyDbPlugin` fails a save whose token is stale, and under (a) or (b) one writer losing
a race would abort unrelated writers in the same batch. Under (c) the retry sorts it out and
only the actual loser sees `OptimisticConcurrencyError`.

## Sketch

```ts
type QueuedWrite = {
    readonly event: DbPluginBulkPersistEvent;
    readonly done: PluginEventCallbackPartialResult<BulkPersistResult>;
};

class BatchingDbPlugin implements IDbPlugin {
    private readonly queue: QueuedWrite[] = [];
    private isWriting = false;

    bulkPersist(event, done) {
        this.queue.push({ event, done });

        // In flight: the completion below will take this. Doing anything else here is what
        // turns a queue into a race.
        if (this.isWriting) {
            return;
        }

        this.drain();
    }

    private drain() {
        // Everything waiting, not one item — that is the whole point.
        const batch = this.queue.splice(0);

        if (batch.length === 0) {
            this.isWriting = false;
            return;
        }

        this.isWriting = true;

        // A single item is not a batch. Pass it through untouched so the common case has no
        // merging, no splitting, and nothing to get wrong.
        if (batch.length === 1) {
            this.plugin.bulkPersist(batch[0].event, result => {
                batch[0].done(result);
                this.drain();
            });
            return;
        }

        const { event, shares } = merge(batch);

        this.plugin.bulkPersist(event, result => {
            distribute(batch, shares, result);   // or fall back to one at a time
            this.drain();
        });
    }
}
```

The single-item passthrough matters more than it looks: it means the uncontended path — which is
most paths — is byte-for-byte what happens today, and the merge/split machinery is only ever
reached when there was something to gain.

## What has to be decided before building

1. **Failure policy.** (c) above is the recommendation; it is the one real decision.
2. **Whether to batch across stores** or only within one. Cross-store batching helps most when
   several stores share a plugin, which is also when the blast radius argument is strongest.
3. **Whether `identity` should scope the queue.** Two plugins over one database are separate
   objects and would not share a queue. Batching cannot fix cross-process contention anyway, so
   probably not — but it is the same question `SqliteDbPlugin`'s write chain already answers by
   being per instance.
4. **Whether a batch has a size ceiling.** A thousand queued writes merged into one transaction
   is one very large statement set, and some engines have limits — D1's `batch()` in particular.
   A ceiling means the drain takes N items rather than all of them, which does not change any of
   the reasoning above.

## How it would be tested

The contract first: `describePluginContract` against `BatchingDbPlugin` wrapping the memory
plugin, which proves batching did not change what a backend does. That is the same check the
retry and cache wrappers already run.

Then the parts the contract cannot see:

- **Attribution.** Several stores over one plugin, each adding rows with database-assigned
  identities, saving concurrently. Every store must get back exactly its own rows with its own
  identities. This is the test that matters; the rest is bookkeeping.
- **The safety valve.** A stub plugin that echoes rows in the wrong order or drops one. Every
  item in the batch must fail, and none may receive another's rows.
- **Failure fallback.** A batch containing one write that cannot succeed. The others land, that
  one fails, and the error reaches the right caller.
- **Concurrency composition.** `ConcurrencyDbPlugin` above `BatchingDbPlugin`, two writers racing
  one row. Exactly one gets `OptimisticConcurrencyError`, and the loser's presence in the batch
  does not fail anyone else.
- **That it actually batches.** Count `bulkPersist` calls on the inner plugin: N concurrent
  saves must produce fewer than N calls. Without this the suite passes just as happily with a
  wrapper that queues and never merges.
- **That it never delays.** A single save with an empty queue must reach the inner plugin in the
  same tick — the datastore's save path is synchronous up to the plugin on purpose, and a
  deferral there reintroduces a recorded defect where saves interleaved and the change tracker
  could no longer match an addition to its echo.

## Expected payoff

Unmeasured, and worth measuring before building rather than after.

The shape to expect: no change to sequential saves, and a reduction in round trips proportional
to how many writers overlap. The case with a known multiplier is a store with views — one save
plus one write per view becomes one write, so a store with three views should approach a quarter
of the write round trips under load.

Against a local file that will be hard to see; the harness in `plugins/sqlite` measured
sequential saves at well under a millisecond each. Against PostgreSQL in a container the round
trip is large enough to dominate, which is where the number should be taken.

## See also

- `plugins/sqlite/src/plugin.ts` — serializing writes for an engine that needs it, and the
  measurements that decided it belonged there rather than in the datastore
- `datastore/src/views/View.ts` — why a store writes more than once per change
- `specs/plugin-roadmap.md` — the four shapes, and why this is a wrapper
- `core/src/plugins/ConcurrencyDbPlugin.ts` — the composition the failure policy has to survive
