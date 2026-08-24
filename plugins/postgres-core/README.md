# @routier/postgres-plugin-core

<p align="center">
  <img src="https://routier.dev/routier.svg" alt="Routier" width="140" height="140" />
</p>

The PostgreSQL half of Routier's SQL plugins, with no database client in it. `@routier/postgresql-plugin`
runs this over `node-postgres`; `@routier/pglite-plugin` runs the same code over PGlite in WebAssembly.

This package is a building block for plugin authors. Application code does not import it — install
the plugin for the engine you use.

## What it provides

| Export | Purpose |
|---|---|
| `PostgresDbPluginBase` | A complete `IDbPlugin`, minus the engine. Construct it with a driver. |
| `PostgresDriver`, `PostgresConnection` | The four operations a PostgreSQL engine has to supply |
| `compiledSchemaToPostgresTable(schema, tableName, vectors)` | `CREATE TABLE` and its indexes, including `vector(n)` columns |
| `buildFromQueryOperation`, `buildJoinQueryOperation` | A `SELECT` and its parameters, from a Routier query |
| `buildFromPersistOperation` | Grouped `INSERT`/`UPDATE`/`DELETE` with `RETURNING` |
| `PostgresSqlTranslator` | Result translation, with the pushdown decisions the builder made |
| `PostgresVectorSupport`, `NO_VECTOR_SUPPORT` | Whether pgvector is usable, decided once per plugin |

## Writing a driver

```ts
import { PostgresDbPluginBase, PostgresDriver } from "@routier/postgres-plugin-core";

const driver: PostgresDriver = {
  name: "my-engine",
  databaseName: "postgres://host:5432/app",
  async connect() {
    const client = await pool.acquire();
    return {
      all: (sql, params) => client.query(sql, params).then((r) => r.rows),
      run: (sql, params) => client.query(sql, params).then(() => undefined),
      release: async () => client.release(),
    };
  },
  dispose: () => pool.drain(),
};

class MyDbPlugin extends PostgresDbPluginBase {
  constructor() {
    super(driver);
  }
}
```

Transactions are not part of the interface. Every engine behind it is PostgreSQL, so `BEGIN`,
`SAVEPOINT` and `ROLLBACK TO SAVEPOINT` are ordinary statements the plugin issues through `run`.

An engine with one connection may delay `connect` until the previous connection is released. The
plugin never holds one connection while asking for another, so serialising there cannot deadlock.

## Behaviour the base plugin supplies

- Tables are created lazily on first use, and a write recovers from `42P01` inside its transaction
  by rolling back to a savepoint, creating the table, and retrying.
- A concurrent creator (`42P07`, `23505`) is absorbed rather than failing the save.
- pgvector is probed once per plugin instance. Without it a `s.vector()` property is stored as
  JSONB and the similarity search runs in memory.
- A token-checked `UPDATE` that matches no row raises `OptimisticConcurrencyError`.
- Joins are pushed down, and refused rather than answered wrongly when a filter has no column.

## License

MIT
