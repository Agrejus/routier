# @routier/sqlite-plugin

Routier storage backed by a SQLite file, through `sqlite3`.

```ts
import { DataStore } from "@routier/datastore";
import { SqliteDbPlugin } from "@routier/sqlite-plugin";

class AppStore extends DataStore {
  constructor() {
    super(new SqliteDbPlugin("./data/app.sqlite"));
  }
}
```

The plugin builds its SQL with `@routier/sql-plugin-core`, which it shares with the PostgreSQL
and MySQL plugins.

## Contracts

### Durability

SQLite's own. A committed transaction is on disk when `COMMIT` returns.

Every save runs inside one `BEGIN IMMEDIATE` transaction. If any statement fails, the whole
save rolls back and the plugin reports the error.

### Column types

SQLite has no boolean, date, array, or object column type. The plugin maps them as follows.

| Schema type | Column type | Notes |
|---|---|---|
| `s.string()` | `TEXT` | |
| `s.number()` | `REAL` | |
| `s.boolean()` | `INTEGER` | Stored as 0 or 1 |
| `s.date()` | `TEXT` | ISO-8601 |
| `s.object()`, `s.array()` | `JSON` | One column per root property |

Nested objects and arrays round-trip without a schema serializer. Booleans and dates come back
as the stored form, so declare `.serialize()` and `.deserialize()` on those properties if you
need the original JavaScript type. This is why the plugin runs the contract kit with
`supportsRichTypes: false`.

### Concurrency

SQLite serializes writers at the file level. The plugin opens one connection per operation and
closes it on every completion path, which is what lets that file locking do its job.

`BEGIN IMMEDIATE` takes the write lock up front, so a contended file fails the save with
`SQLITE_BUSY` instead of failing part-way through.

Optimistic concurrency is supported. Wrap the plugin in `ConcurrencyDbPlugin` and a stale
write fails with `OptimisticConcurrencyError` naming the row.

### Process boundary

Several processes may use one file. SQLite's locking makes that safe. Throughput is another
matter: writers wait for each other.

### Schema migration

**Initialization only.** The plugin runs `CREATE TABLE` when a table is missing. It never
alters an existing table.

A schema change that adds, removes, or renames a column does not change a table that already
exists, and the next write fails on the missing column. Migrate the database yourself.

### Disposal

Call `store.destroyAsync()` to close and delete the database file.

Connections are per-operation and always closed, so a store that is never destroyed holds no
file handles. A test run needs no `--forceExit` on account of this plugin.

### Failure semantics

- A statement error rolls the transaction back and fails the save.
- A file that cannot be opened — a directory in its place, a permissions failure, a missing
  parent — fails the operation. It does not crash the process and does not hang.
- A concurrency conflict fails the save with `OptimisticConcurrencyError` and writes nothing.

## Supported versions

Node 18 or later. `sqlite3` version 5, which needs a native build for your platform.

## See also

- [SQLite plugin guide](../../docs/integrations/plugins/built-in-plugins/sqlite/README.md)
