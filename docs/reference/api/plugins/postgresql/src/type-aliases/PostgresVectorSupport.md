[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/postgresql/src](../README.md) / PostgresVectorSupport

# Type Alias: PostgresVectorSupport

> **PostgresVectorSupport** = `object`

Defined in: plugins/postgres-core/dist/utils.d.ts:15

What this connection can do with a vector, decided once by probing for pgvector.

Passed rather than detected here because DDL generation is synchronous and the answer is a
fact about the server. The SAME value must reach the DDL and the query builder: a table
created as `JSONB` with a `<=>` ordering run against it is a type error at query time, and
the reverse silently reads a native vector column as JSON.

## Properties

### available

> `readonly` **available**: `boolean`

Defined in: plugins/postgres-core/dist/utils.d.ts:17

True when the `vector` extension is installed and a `vector(n)` column is usable.
