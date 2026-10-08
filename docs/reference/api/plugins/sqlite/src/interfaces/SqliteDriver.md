[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sqlite/src](../README.md) / SqliteDriver

# Interface: SqliteDriver

Defined in: [plugins/sqlite/src/drivers/types.ts:46](https://github.com/Agrejus/routier/blob/main/plugins/sqlite/src/drivers/types.ts#L46)

## Properties

### name

> `readonly` **name**: `string`

Defined in: [plugins/sqlite/src/drivers/types.ts:48](https://github.com/Agrejus/routier/blob/main/plugins/sqlite/src/drivers/types.ts#L48)

Names the engine, for error messages that would otherwise not say which one failed.

***

### foldsUnicodeCasing

> `readonly` **foldsUnicodeCasing**: `boolean`

Defined in: [plugins/sqlite/src/drivers/types.ts:51](https://github.com/Agrejus/routier/blob/main/plugins/sqlite/src/drivers/types.ts#L51)

Whether this engine accepts a replacement `lower()`. SQLite's own folds ASCII only.

***

### keepsConnections?

> `readonly` `optional` **keepsConnections**: `boolean`

Defined in: [plugins/sqlite/src/drivers/types.ts:53](https://github.com/Agrejus/routier/blob/main/plugins/sqlite/src/drivers/types.ts#L53)

## Methods

### open()

> **open**(`databaseName`): `Promise`\<[`SqliteConnection`](SqliteConnection.md)\>

Defined in: [plugins/sqlite/src/drivers/types.ts:63](https://github.com/Agrejus/routier/blob/main/plugins/sqlite/src/drivers/types.ts#L63)

Opens `databaseName`.

A failure to open must reject rather than throw asynchronously. The `sqlite3` driver
reported it by emitting `error` on the database object, which Node turned into an
uncaught exception that crashed the process and left the operation hanging — known
defect #34. Every driver here has to convert that into a rejected promise.

#### Parameters

##### databaseName

`string`

#### Returns

`Promise`\<[`SqliteConnection`](SqliteConnection.md)\>

***

### deleteDatabase()

> **deleteDatabase**(`databaseName`): `Promise`\<`void`\>

Defined in: [plugins/sqlite/src/drivers/types.ts:71](https://github.com/Agrejus/routier/blob/main/plugins/sqlite/src/drivers/types.ts#L71)

Removes the database. Succeeds when it does not exist.

What "remove" means is the engine's business: a file to unlink in Node, an OPFS entry
to delete in a browser.

#### Parameters

##### databaseName

`string`

#### Returns

`Promise`\<`void`\>
