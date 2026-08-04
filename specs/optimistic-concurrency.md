# Optimistic concurrency

Status: **Shipped as a wrapper plugin — zero schema/builder surface.**
Date: 2026-08-03

## Why it exists

The finance stress app (`examples/finance-stress`) measured what happens when concurrent
writers share a mutable row with no protection: at 10 simulated users transferring money,
**$8,566 of a $75,000 ledger disappeared in 30 seconds** — lost updates, each one a write
computed from a stale read silently overwriting another writer's save. The single-writer
control run drifted $0.00 at the same rate, isolating concurrency as the cause. Silent
data loss is the one failure mode a data layer is never allowed to have, so detection
belongs in routier, not in every caller.

## The API — one wrap

```ts
import { ConcurrencyDbPlugin } from '@routier/core/plugins';

class Bank extends DataStore {
    constructor() {
        super(new ConcurrencyDbPlugin(new SqlitePlugin('bank.db')));
    }
    accounts = this.collection(accountSchema).diff().create();   // nothing declared
}
```

Nothing on the schema, nothing on the collection builder, nothing on the entity. The
plugin maintains a hidden `__version` column in the same tables/records as the data:

- **Add** → the row's token starts at 1.
- **Update** → applied ONLY IF the stored token still equals the version this store last
  observed for the row (from a query or a persist echo); bumped on success.
- **Lost the race** → `saveChangesAsync()` rejects with `OptimisticConcurrencyError`
  (exported from `@routier/core`), carrying `collectionName` and `conflicts` (row ids).
  Recovery: re-read (which re-arms the observation), reapply the intent, save again.
- **Unwrapped plugin** → last-writer-wins, exactly as before. Fully opt-in by construction.

Design history, for the record: this went through a schema modifier
(`s.number().concurrency()`), a builder chain method, and a builder options bag before
landing here. Each made the *user* declare and wire a token; the wrapper makes concurrency
what it architecturally is — a persistence-layer behavior, living in the persistence
layer, invisible above it.

## How the hidden column exists without schema changes

The wrapper hands the inner plugin an **augmented view** of each compiled schema — the
same object via prototype delegation, with one synthetic `__version` property appended to
`properties`. That list is what the storage plugins read to build DDL, INSERT and SELECT
column lists, so the column materializes and round-trips through unmodified plugin code.
Above the wrapper the real schema is untouched, and the datastore's generated
deserialize/enrich drop undeclared fields, so `__version` never appears on an entity.

Two load-bearing subtleties:

- The synthetic property carries `from: '__version'`, which flips EphemeralDataPlugin's
  query cloning to `structuredClone` (the generated clone drops undeclared fields) — that
  is what lets the wrapper observe the token on reads from the in-process plugins.
- Persist echoes from the in-process plugins are the stored records BY REFERENCE, so the
  wrapper records the token from echoes but never strips it there — deleting it would
  erase the stored token itself. Query results are plugin-made copies and are stripped.

## What "expected" means

Per store instance: the version this wrapper last observed for the row (query result or
persist echo), keyed `collection → id`. A row updated without ever being read through the
store (rare — attaching a foreign instance) has no observation; its write is applied
unchecked and initializes the token, and the row is protected from the next read on. A
conflict invalidates the losing observations so the retry's re-read re-arms cleanly.

## Enforcement by inner plugin

The conditional check is performed by the INNER plugin via the
`EntityUpdateInfo.concurrency` contract field — the wrapper stamps
`{ column: '__version', expected }` and composes with the enforcement machinery:

| Inner plugin | Enforced | How |
| --- | --- | --- |
| memory, file-system (EphemeralDataPlugin) | ✅ | all conditional updates verified against stored rows BEFORE anything is applied |
| sqlite | ✅ | one conditional `UPDATE ... WHERE id = ? AND "__version" = ? RETURNING ...` per row (`buildConditionalUpdateOperations`, chosen when any update carries a concurrency payload); zero returned rows → ROLLBACK + error |
| postgresql | ✅ | same, verified against a real server (`e2e/src/postgresContainer.test.ts`) |
| dexie, pouchdb, mysql, replication | ❌ **not yet** | the contract field is ignored — a wrapped store on these gets the token stored but not checked. PouchDB's `_rev` is the natural implementation |

## Limits, stated

- **Existing SQL tables** created before adopting the wrapper lack the column; new tables
  get it from the augmented DDL automatically. Migration: `ALTER TABLE ... ADD COLUMN
  "__version"` (number type for the engine). A lazy-ALTER on column-missing errors, like
  the lazy CREATE TABLE pattern, is the natural future improvement.
- **Cross-store entities**: observations live in the wrapper instance, so an entity
  attached into a DIFFERENT store has no expected value there until that store reads it.
- **A failed save applies nothing and KEEPS the pending intent** — queued adds/removals
  and dirty state survive in the tracker, so a retry refreshes the stale rows and simply
  saves again. Do not re-create the intent on retry; that doubles it.
- **Diff-mode conflict recovery needs a detach** before the re-read
  (`attachments.remove(...)`) — a dirty diff attachment deliberately protects local edits
  from re-reads. Proxy mode just re-reads.
- **Saves are all-or-nothing across collections everywhere.** SQL rolls back as one
  transaction; the in-process plugins validate every collection before applying anything
  and revert via an undo log on failure (this closed the orphan-ledger-row-per-conflict
  gap the finance A/B exposed). The remaining in-process honesty gap is crash-safety
  across FILES — a process dying between two file writes can leave disk partial.

## Measured

Finance app (`ConcurrencyDbPlugin(MemoryPlugin)`), 50 simulated users, thousands of
committed transactions: invariant drift **$0.00**, zero failed saves, save p99 ≤ 0.3ms,
and account entities carry exactly their declared keys — no token visible anywhere. A
forced two-writer race in the live browser bundle throws `OptimisticConcurrencyError`
naming the row.

## Guarded by

- `datastore/src/collections/OptimisticConcurrency.test.ts` — invisibility, proxy + diff
  conflicts, retry, error payload, unwrapped-plugin opt-out.
- `plugins/sqlite/src/tests/optimisticConcurrency.test.ts` — hidden column in real DDL,
  rollback, retry.
- `e2e/src/postgresContainer.test.ts` `optimistic concurrency` — real server.
