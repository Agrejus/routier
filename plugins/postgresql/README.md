# @routier/postgresql-plugin

<p align="center">
  <img src="https://routier.dev/routier.svg" alt="Routier" width="140" height="140" />
</p>

Routier storage backed by a PostgreSQL server, through `pg`.

```ts
import { DataStore } from "@routier/datastore";
import { PostgresDbPlugin } from "@routier/postgresql-plugin";

class AppStore extends DataStore {
  constructor() {
    super(new PostgresDbPlugin({
      host: "localhost",
      port: 5432,
      database: "app",
      user: "app",
      password: process.env.PGPASSWORD,
      pool: { max: 10 },
    }));
  }
}
```

The plugin builds its SQL with `@routier/sql-plugin-core`, which it shares with the SQLite and
MySQL plugins.

## Contracts

### Durability

PostgreSQL's own, subject to the server's `synchronous_commit` setting.

Every save runs inside one transaction on one pooled client. The plugin uses a `SAVEPOINT`
before each statement so it can create a missing table and retry without the aborted
transaction poisoning the rest of the save.

### Column types

| Schema type | Column type | Notes |
|---|---|---|
| `s.string()` | `TEXT` | |
| `s.number()` | `DOUBLE PRECISION` | Not `NUMERIC`: `pg` returns `NUMERIC` as a string |
| `s.boolean()` | `BOOLEAN` | |
| `s.date()` | `TIMESTAMP` | |
| `s.object()`, `s.array()` | `JSONB` | One column per root property |

Written rows come back through `RETURNING`, so a save echoes exactly the rows it wrote.

### Concurrency

The plugin holds a `pg` connection pool. Each save takes one client for the length of its
transaction and returns it on every path, including failures. Concurrent saves are as
concurrent as the pool allows and are isolated by the server.

Optimistic concurrency is supported. Wrap the plugin in `ConcurrencyDbPlugin`. A stale write
matches no row, and the plugin rolls the transaction back and reports
`OptimisticConcurrencyError` naming the row. Nothing is written, including changes to rows
that did not themselves conflict.

### Logging

The plugin logs through `@routier/core`'s logger, which is silent by default. Set
`ROUTIER_LOG_LEVEL=debug` to see the SQL it runs.

**Parameter values are never logged**, at any level. Bound parameters are row data. The logs
carry the SQL text and the parameter count, which is what diagnoses a binding mismatch.

### Schema migration

**Initialization only.** The plugin runs `CREATE TABLE` when a table is missing. It never
alters an existing table.

A schema change that adds, removes, or renames a column does not change a table that already
exists, and the next write fails on the missing column. Migrate the database yourself.

### Disposal

Call `store.destroyAsync()` to end the pool. This closes the sockets; **it does not drop
tables**.

A pool that is never ended holds its idle clients open and keeps the Node event loop alive. In
tests, destroy every store you create, or the run hangs after the last assertion.

### Failure semantics

- A statement error rolls the whole transaction back and fails the save. Nothing is written.
- A duplicate key fails the save and returns the client to the pool.
- An idle client dropped by a server restart is discarded by the pool's error handler. The
  process does not crash; the next operation opens a new client.
- A server that goes away mid-transaction fails that save.

## Supported versions

Node 18 or later. PostgreSQL 12 or later; the suites run against `postgres:16-alpine`.

## See also

- `e2e/src/postgresContainer.test.ts` — behaviour against a real server, including failure paths
- `e2e/src/dialectConformance.test.ts` — the shared SQL matrix
