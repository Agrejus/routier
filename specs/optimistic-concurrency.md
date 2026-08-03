# Optimistic concurrency

Status: **Shipped, opt-in per schema.**
Date: 2026-08-03

## Why it exists

The finance stress app (`examples/finance-stress`) measured what happens when concurrent
writers share a mutable row with no protection: at 10 simulated users transferring money,
**$8,566 of a $75,000 ledger disappeared in 30 seconds** — lost updates, each one a write
computed from a stale read silently overwriting another writer's save. The single-writer
control run drifted $0.00 at the same rate, isolating concurrency as the cause. Silent
data loss is the one failure mode a data layer is never allowed to have, so detection
belongs in routier, not in every caller.

## The API

The schema stays pure data — the token is an ordinary number property. The COLLECTION
declares that it is the concurrency token, in the same builder chain where every other
write behavior lives:

```ts
const account = s.define('accounts', {
    id: s.string().key().identity(),
    balance: s.number(),
    version: s.number(),                    // plain data
}).compile();

class Bank extends DataStore {
    accounts = this.collection(account)
        .diff()
        .concurrency(x => x.version)        // the whole opt-in
        .create();
}
```

(An earlier revision used a schema modifier, `s.number().concurrency()`. It was replaced:
the schema describes shape, the builder describes behavior — the same split as tracking
modes. The consistency rule is also the same as tracking modes: every store class writing
a database must declare it identically; a writer without the declaration bypasses the
checks.)

- **Add** → the token starts at 1 (stamped by the tracker; a caller-supplied value is
  kept, so imports can carry tokens).
- **Update** → the save carries `{ column, expected }` (the token as read) and stores
  `expected + 1`. The plugin applies the update ONLY IF the stored token still equals
  `expected`.
- **Lost the race** → `saveChangesAsync()` rejects with `OptimisticConcurrencyError`
  (exported from `@routier/core`), carrying `collectionName` and `conflicts` (the row ids).
  Recovery is always: re-read, reapply the intent, save again.
- No `.concurrency()` on the schema → nothing changes anywhere.

## How it flows

1. `ConfiguredCollectionBuilder.concurrency(selector)` resolves the root property
   (validated: number, not key/identity) and sets `ChangeTracker.concurrencyProperty`.
2. `ChangeTracker.stampConcurrency` runs in every update path (proxy, diff, immutable):
   `expected` is read from the serialized entity, the wire payload gets the bumped value,
   and the canonical is NOT mutated — a failed save leaves it accurate. The bump is written
   into the delta only when the delta carries columns; an EMPTY delta means "write the
   whole entity" and making it non-empty would narrow the write to the token alone.
3. `EntityUpdateInfo.concurrency` carries `{ column, expected }` to the plugin.

## Enforcement by plugin

| Plugin | Enforced | How |
| --- | --- | --- |
| memory, file-system (EphemeralDataPlugin) | ✅ | all conditional updates verified against stored rows BEFORE anything is applied; conflicts abort the collection's save with nothing written |
| sqlite | ✅ | one conditional `UPDATE ... WHERE id = ? AND token = ? RETURNING ...` per row (`buildConditionalUpdateOperations` in sql-plugin-core); zero returned rows → ROLLBACK + error |
| postgresql | ✅ | same, verified against a real server (`e2e/src/postgresContainer.test.ts`) |
| dexie, pouchdb, mysql, replication | ❌ **not yet** | the `concurrency` field is ignored — a token-carrying schema on these plugins gets last-writer-wins with no error. PouchDB's `_rev` is the natural implementation; mysql needs the conditional per-row form + affected-rows |

**The unenforced list is the sharp edge.** A schema with `.concurrency()` on dexie today
looks protected and is not. Before publicizing the feature, either implement those plugins
or make an unenforcing plugin REJECT token-carrying schemas loudly.

## Semantics worth knowing

- **Whole-save failure.** A conflict rejects the save; for SQL the transaction rolls back
  as a unit. For the in-process plugins atomicity is per collection — a multi-schema save
  where an earlier schema already applied is not unwound (pre-existing plugin semantics).
- **A failed save clears pending adds/removals** (existing behavior). Retries re-create
  the whole intent — which is what keeps ledger-row counts exact in the finance app.
- **Diff-mode recovery needs a detach.** A dirty diff-tracked attachment deliberately
  protects local edits from re-reads, so after a conflict the caller must
  `attachments.remove(...)` the stale instances (or the re-read hands back the same stale
  values). Proxy mode just re-reads.
- **Legacy rows** (no token value yet): the write initializes the token to 1
  unconditionally rather than failing rows that predate the schema change.
- **Zero-row ambiguity (SQL):** a checked update that matches nothing is reported as a
  conflict even if the row was deleted rather than changed — both mean "your read is
  stale", and the recovery is identical.

## Measured

Finance app, 50 simulated users, ~230–500 tx/s, 26k+ committed transactions: invariant
drift **$0.00**, zero failed saves, save p99 ≤ 0.3ms. In-process the natural conflict rate
is near zero (each retry re-reads microtasks before saving on one event loop); a forced
two-writer race in the live browser bundle throws `OptimisticConcurrencyError` naming the
row. Against a network backend, the read-to-save window is real latency and the token is
what turns lost updates into retries.

## Guarded by

- `datastore/src/collections/OptimisticConcurrency.test.ts` — lifecycle, proxy + diff
  conflicts, retry, error payload, opt-out unaffected.
- `plugins/sqlite/src/tests/optimisticConcurrency.test.ts` — real file, rollback, retry.
- `e2e/src/postgresContainer.test.ts` `optimistic concurrency` — real server.
