# @routier/dexie-plugin

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

- [Dexie plugin guide](../../docs/integrations/plugins/built-in-plugins/dexie/README.md)
