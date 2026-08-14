# @routier/mysql-plugin

<p align="center">
  <img src="https://routier.dev/routier.svg" alt="Routier" width="140" height="140" />
</p>

Routier storage backed by a MySQL server, through `mysql2`.

```ts
import { DataStore } from "@routier/datastore";
import { MysqlDbPlugin } from "@routier/mysql-plugin";

class AppStore extends DataStore {
  constructor() {
    super(new MysqlDbPlugin({
      host: "localhost",
      port: 3306,
      database: "app",
      user: "app",
      password: process.env.MYSQL_PASSWORD,
      pool: { max: 10 },
    }));
  }
}
```

Pass `connectionString` instead of the discrete fields to use a URI:

```ts
new MysqlDbPlugin({ connectionString: "mysql://app:secret@localhost:3306/app" });
```

The two forms are mutually exclusive. Supplying both throws, because there is no correct
precedence to guess — a URI that disagrees with an explicit `host` means the configuration
says something the caller does not believe.

There is no `pool.min`. `mysql2` opens connections on demand and has no minimum-size setting.

## Contracts

### Durability

MySQL's own, subject to `innodb_flush_log_at_trx_commit`.

Every save runs inside one transaction on one pooled connection. Table creation happens
**before** the transaction opens: MySQL commits the open transaction implicitly when it runs
DDL, so a table created mid-save would end that save's transaction and leave a later failure
with nothing to roll back.

### Column types

| Schema type | Column type | Notes |
|---|---|---|
| `s.string()` | `VARCHAR(255)` | |
| `s.number()` | `DOUBLE` | Not `DECIMAL`: `mysql2` returns `DECIMAL` as a string |
| `s.boolean()` | `BOOLEAN` | A synonym for `TINYINT(1)`; the plugin decodes 0/1 back to booleans |
| `s.date()` | `DATETIME` | Stored in UTC; the pool sets `timezone: 'Z'` |
| `s.object()`, `s.array()` | `JSON` | One column per root property |

### Select-back after a write

MySQL has no `RETURNING`, so the plugin reads written rows back with a second statement. It
picks one of three strategies:

1. **Caller-supplied keys** — select by `key IN (…)`.
2. **Composite keys** — select by an `OR` of full-key conjunctions.
3. **A single `AUTO_INCREMENT` key** — select the range `insertId … insertId + n - 1`.

Strategy 3 assumes the insert allocated a **contiguous** id block. That holds for the single
`INSERT` statement the plugin emits when `innodb_autoinc_lock_mode` is 0 or 1 and
`auto_increment_increment` is 1.

Under `innodb_autoinc_lock_mode = 2` (interleaved), or a non-1 `auto_increment_increment` on a
multi-source setup, the block is not contiguous. The plugin then reads back the wrong number
of rows and **fails the save** with a message naming both settings. It does not echo the wrong
rows.

Set `innodb_autoinc_lock_mode` to 0 or 1 if you use numeric identity keys.

### Concurrency

The plugin holds a `mysql2` pool. Each save takes one connection for the length of its
transaction and returns it on every path, including a failed rollback.

Optimistic concurrency is supported. Wrap the plugin in `ConcurrencyDbPlugin`. A stale write
matches no row; the plugin detects it from `affectedRows` — there is no `RETURNING` to be
empty — rolls the transaction back, and reports `OptimisticConcurrencyError` naming the row.

### Schema migration

**Initialization only.** The plugin runs `CREATE TABLE IF NOT EXISTS` when a table is missing.
It never alters an existing table.

A schema change that adds, removes, or renames a column does not change a table that already
exists, and the next write fails on the missing column. Migrate the database yourself.

### Disposal

Call `store.destroyAsync()` to end the pool. This closes the sockets; **it does not drop
tables**.

A pool that is never ended keeps the Node event loop alive. In tests, destroy every store you
create.

### Failure semantics

- A statement error rolls the whole transaction back and fails the save. Because DDL runs
  first, the rollback is total.
- A duplicate key fails the save and returns the connection to the pool.
- An `undefined` parameter is bound as SQL `NULL`. `mysql2` rejects `undefined` outright,
  where other drivers accept it, so an entity that omits an optional property would otherwise
  fail to insert.

## Supported versions

Node 18 or later. MySQL 8.0 or later, for the `JSON` column type; the suites run against
`mysql:8.0`.

## See also

- `e2e/src/mysqlContainer.test.ts` — behaviour against a real server, plus the contract kit
- `e2e/src/dialectConformance.test.ts` — the shared SQL matrix
