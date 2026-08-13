[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sqlite/src](../README.md) / SqliteDriver

# Interface: SqliteDriver

Defined in: [plugins/sqlite/src/drivers/types.ts:28](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sqlite/src/drivers/types.ts#L28)

## Properties

### name

> `readonly` **name**: `string`

Defined in: [plugins/sqlite/src/drivers/types.ts:30](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sqlite/src/drivers/types.ts#L30)

Names the engine, for error messages that would otherwise not say which one failed.

## Methods

### open()

> **open**(`databaseName`): `Promise`\<[`SqliteConnection`](SqliteConnection.md)\>

Defined in: [plugins/sqlite/src/drivers/types.ts:40](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sqlite/src/drivers/types.ts#L40)

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

Defined in: [plugins/sqlite/src/drivers/types.ts:48](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sqlite/src/drivers/types.ts#L48)

Removes the database. Succeeds when it does not exist.

What "remove" means is the engine's business: a file to unlink in Node, an OPFS entry
to delete in a browser.

#### Parameters

##### databaseName

`string`

#### Returns

`Promise`\<`void`\>
