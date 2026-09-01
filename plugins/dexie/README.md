# @routier/dexie-plugin

<p align="center">
  <img src="https://routier.dev/routier.svg" alt="Routier" width="140" height="140" />
</p>

Routier storage backed by IndexedDB, through Dexie.

```ts
import { DataStore } from "@routier/datastore";
import { DexiePlugin } from "@routier/dexie-plugin";

class AppStore extends DataStore {
  constructor() {
    super(new DexiePlugin("my-database", { version: 1 }));
  }
}
```

Use this instead of `@routier/browser-storage-plugin` for anything above a few thousand rows:
IndexedDB is asynchronous and indexed, where `localStorage` is synchronous and capped near
5 MB.

## Contracts

### Durability

IndexedDB's own. A committed transaction survives a reload and a browser restart. The browser
can evict the whole origin under storage pressure.

### Atomicity

**One transaction per save.** Every collection the save touches joins one
`db.transaction('rw', …)`, ordered removes, then updates, then adds. A failure in the second
collection rolls back the first.

Generated identity keys are assigned inside that transaction, so they roll back with
everything else.

### Schema versioning

IndexedDB keys a database's index layout to a version number, and redefining one version with
a different layout is an error rather than a migration.

Pass `version` to the constructor. It defaults to `1`.

**Bump it whenever the schema changes** — a new collection, a new index, a renamed key. Dexie
absorbs purely additive changes on its own and logs that it did so, but anything else fails.
When it fails, the plugin reports an error naming the database, the version in use, and the
option to raise.

There is no data migration hook. Dexie rebuilds the index layout; it does not transform stored
records.

### Concurrency

IndexedDB transactions are isolated by the browser, and Dexie serializes work within one
connection. Two tabs may both write: each save is atomic, and the last writer wins per record.

**Optimistic concurrency is not supported.** Dexie offers no conditional-update primitive to
build it on, so `ConcurrencyDbPlugin` cannot detect a stale write here. Use a backend plugin
if you need it.

### Query execution

A filter runs as a JavaScript predicate over a cursor walk unless part of it can become an
IndexedDB index seek. A seek needs a property the schema declares with `.index()`,
`.distinct()`, or as a single primary key, and one of these shapes on a string or number value:

- a strict equality, `x.status === p.s`
- an OR of strict equalities on one property, `x.status === p.a || x.status === p.b`
- one or two range bounds on one property, `x.amount >= p.lo && x.amount < p.hi`
- a strict equality on every member of a compound `.index("name")` group

The rest of the filter runs over the seeked rows. Date values never seek: rows store dates as
ISO strings, which a Date key does not match. Declare an index on every property you filter
by; `.explain()` shows which path a query took.

`count()` runs in Dexie when the query has no window or projection. A single sort on an
indexed, non-nullable string, number, or Date property runs as an index walk when no seek is
in use; a remaining predicate is applied during the walk. `skip` and `take` run in Dexie after
the predicates, and stop the cursor early, unless a sort still has to happen in memory.

### Tab boundary

Several tabs share one IndexedDB database. They do not see each other's writes until they
re-query — the plugin does not subscribe to Dexie's change events.

### Disposal

Call `store.destroyAsync()` to delete the database.

The plugin opens a connection per operation and closes it, including on the error path. An
open connection blocks a version upgrade of the same database, which is why the error path
closes too.

### Failure semantics

- A failed transaction rolls back completely and fails the save.
- A schema layout that conflicts with the stored version fails with a message naming the
  `version` option.
- A quota overflow fails the save with the browser's error.

## Supported versions

Any browser with IndexedDB. Dexie 4. In Node, the suites use `fake-indexeddb`.

## See also

- [Dexie plugin guide](https://routier.dev/integrations/plugins/built-in-plugins/dexie/README)
