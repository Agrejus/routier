# @routier/memory-plugin

<p align="center">
  <img src="https://routier.dev/routier.svg" alt="Routier" width="140" height="140" />
</p>

In-process storage for Routier. Data lives in JavaScript objects and disappears when the
process ends.

Use it for tests, demos, and process-local transient data. Do not use it for anything that
must survive a restart.

```ts
import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";

class AppStore extends DataStore {
  constructor() {
    super(new MemoryPlugin("my-database"));
  }
}
```

## Contracts

### Durability

None. The plugin holds every record in a `Map`. A process exit loses all of it.

### Process boundary

One process. Two processes that use the same database name hold two separate databases.

### Named database registry

The name addresses a database, like a SQLite file path or a PostgreSQL database name. The
plugin keeps one database per NAME, shared by every plugin instance in the process. Two
`MemoryPlugin("app")` instances read and write the same records, and live queries in one store
update when the other saves. `new MemoryPlugin()` uses a fixed default name, so all unnamed
instances share one database. This sharing is intended.

Reads return copies, never shared object references. Only saved changes cross stores; an
unsaved edit in one store is not visible to another.

This makes multi-store tests behave like a real database, and it has one consequence you must
know: `destroy()` clears the named database for **every** user of that name, not only for the
instance you call it on. Give each test its own database name if the tests run in one process,
for example ``new MemoryPlugin(`test-${crypto.randomUUID()}`)``.

### Concurrency

Writes are synchronous, so a save applies as one unit. There is no cross-process coordination
because there is no cross-process anything.

### Schema migration

Not applicable. The plugin stores whole entities and derives nothing from a schema at write
time.

### Disposal

Call `store.destroyAsync()` to clear the named database. The plugin holds no file handles,
sockets, or timers, so a store that is never destroyed leaks nothing beyond its records.

### Failure semantics

A save fails only if the change tracker rejects it. There is no I/O to fail.

## Supported versions

Node 18 or later, and any browser. The plugin has no dependencies outside `@routier/core`.

## See also

- [Memory plugin guide](https://routier.dev/integrations/plugins/built-in-plugins/memory/README)
