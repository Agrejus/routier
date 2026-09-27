[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/postgresql/src](../README.md) / PostgresDriver

# Interface: PostgresDriver

Defined in: plugins/postgres-core/dist/drivers/types.d.ts:33

## Properties

### name

> `readonly` **name**: `string`

Defined in: plugins/postgres-core/dist/drivers/types.d.ts:35

Names the engine, for error messages that would otherwise not say which one failed.

***

### databaseName

> `readonly` **databaseName**: `string`

Defined in: plugins/postgres-core/dist/drivers/types.d.ts:43

See `IDbPlugin.databaseName`, whose contract this value satisfies on the plugin's behalf.

Must identify the server and database, must be the same string for two instances over
one database, and must not contain credentials — it becomes part of a subscription
channel key.

## Methods

### connect()

> **connect**(): `Promise`\<[`PostgresConnection`](PostgresConnection.md)\>

Defined in: plugins/postgres-core/dist/drivers/types.d.ts:54

Takes a connection.

A driver whose engine cannot run two transactions at once may delay this until the
previous connection is released; the plugin never holds one connection while asking for
another, so serialising here cannot deadlock.

Must reject rather than throw synchronously. `pg` throws out of `pool.connect` once the
pool has ended, which lands past the caller as an unhandled exception.

#### Returns

`Promise`\<[`PostgresConnection`](PostgresConnection.md)\>

***

### destroy()

> **destroy**(): `Promise`\<`void`\>

Defined in: plugins/postgres-core/dist/drivers/types.d.ts:67

The driver's half of `IDbPlugin.destroy`, and what destroy means for this engine.

A server driver ends its pool and leaves the data: a client destroying its own store must
not drop somebody's database. An embedded driver, which owns the storage it created,
closes the engine **and deletes the data** — that is what the shared plugin contract
requires of an embedded plugin, and what `@routier/sqlite-plugin` does.

One member rather than a release followed by a delete, because for an engine that
serialises access the two have to happen in one turn. Anything between them can start work
against a database that is about to be deleted underneath it.

#### Returns

`Promise`\<`void`\>
