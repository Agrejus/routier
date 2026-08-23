---
title: Server Database Plugins
---

# Server Database Plugins

Routier ships storage plugins for PostgreSQL, MySQL, and MongoDB. Each creates missing tables/collections lazily. None performs general schema migrations; manage production migrations in your deployment tooling.

## PostgreSQL

```bash
npm install @routier/postgresql-plugin pg
```

```ts
import { PostgresDbPlugin } from "@routier/postgresql-plugin";

const plugin = new PostgresDbPlugin({
  host: "localhost",
  port: 5432,
  database: "app",
  user: "app",
  password: process.env.PGPASSWORD,
  pool: { min: 2, max: 10 },
  // connectionString may be used instead
});
```

A save uses one transaction and one pooled client. Root objects/arrays use JSONB. PostgreSQL uses pgvector for `s.vector()` and `.nearest()` when the extension is available, otherwise Routier scores candidates in memory. `ConcurrencyDbPlugin` is supported.

This plugin needs a server. For the same dialect in a browser or in tests, use the [PGlite plugin](/integrations/plugins/built-in-plugins/pglite/README) — it runs PostgreSQL in WebAssembly and builds its statements from the same package.

## MySQL

```bash
npm install @routier/mysql-plugin mysql2
```

```ts
import { MysqlDbPlugin } from "@routier/mysql-plugin";

const plugin = new MysqlDbPlugin({
  host: "localhost",
  port: 3306,
  database: "app",
  user: "app",
  password: process.env.MYSQL_PASSWORD,
  pool: { max: 10 },
});

// Alternative; do not combine with discrete connection fields.
new MysqlDbPlugin({ connectionString: "mysql://app:secret@localhost:3306/app" });
```

`connectionString` and discrete target fields are mutually exclusive. `pool.max` defaults to 10; there is no `pool.min` because mysql2 opens connections on demand. A save is one transaction. Root objects/arrays use JSON. `s.string({ maxLength })` maps to `VARCHAR(maxLength)`; an unbounded string maps to `VARCHAR(255)`. `ConcurrencyDbPlugin` is supported.

## MongoDB

The package exports both a storage plugin and the MQL translator.

```bash
npm install @routier/mongodb-plugin mongodb
```

```ts
import { MongoClient } from "mongodb";
import { MongoClientDriver, MongoDbPlugin } from "@routier/mongodb-plugin";

const client = new MongoClient(process.env.MONGODB_URL!);
await client.connect();

const driver = new MongoClientDriver(client, "app", {
  transactions: "required", // replica set
});
const plugin = new MongoDbPlugin(driver);
```

For a standalone local `mongod`, state the loss of atomic multi-collection saves explicitly:

```ts
const driver = new MongoClientDriver(client, "app", {
  transactions: "unavailable",
});
```

There is no auto-detection: silently losing transactions when deployment topology changes would be unsafe. The plugin validates Mongo-specific schema rules, translates pushable filters to MQL, and supports conditional updates for `ConcurrencyDbPlugin`.

Advanced exports include `toMql(expression)`, `toFieldPath(property)`, `MongoTranslator`, `assertMongoSchema`, and the `MongoDriver` interfaces for custom drivers.

## Shared behavior

- Query operations are pushed down when the backend can represent them and completed in memory otherwise.
- A schema property renamed with `.from()` uses the storage name in generated SQL/MQL.
- A save can span multiple schemas. PostgreSQL, MySQL, and transactional MongoDB commit it atomically.
- Missing structures are created; changing existing columns, indexes, or types is your migration responsibility.
- `destroyAsync()` destroys the database represented by the plugin. Use disposal when you only need to release a store without deleting data.

## Related

- [Plugin Catalog](/integrations/plugins/built-in-plugins/)
- [Wrapper Plugins](/integrations/plugins/built-in-plugins/wrappers)
- [Queries](/concepts/queries/)
- [Vector Search](/concepts/queries/vector-search)
