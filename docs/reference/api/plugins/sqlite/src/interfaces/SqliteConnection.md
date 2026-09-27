[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sqlite/src](../README.md) / SqliteConnection

# Interface: SqliteConnection

Defined in: [plugins/sqlite/src/drivers/types.ts:14](https://github.com/Agrejus/routier/blob/main/plugins/sqlite/src/drivers/types.ts#L14)

One open connection. The plugin opens one per operation and closes it on every path.

## Methods

### all()

> **all**(`sql`, `params?`, `result?`): `Promise`\<`unknown`[]\>

Defined in: [plugins/sqlite/src/drivers/types.ts:29](https://github.com/Agrejus/routier/blob/main/plugins/sqlite/src/drivers/types.ts#L29)

Runs a statement and returns its rows.

Used for `SELECT` and for writes with `RETURNING`, which is how the plugin echoes saved
rows back to the change tracker.

`result` describes the columns the statement returns, in order, and is a HINT: every
driver is free to ignore it and return the same rows, which is what all but the WASM one
do. A driver that pays to move rows across a boundary can use it to encode them columnar
instead — it decides that, because only it knows what shapes its engine hands back.

Absent when the statement's result cannot be described. Never a promise about the rows'
content; the rows are identical either way.

#### Parameters

##### sql

`string`

##### params?

readonly `unknown`[]

##### result?

readonly `ResultColumn`[]

#### Returns

`Promise`\<`unknown`[]\>

***

### run()

> **run**(`sql`, `params?`): `Promise`\<`void`\>

Defined in: [plugins/sqlite/src/drivers/types.ts:32](https://github.com/Agrejus/routier/blob/main/plugins/sqlite/src/drivers/types.ts#L32)

Runs a statement that returns nothing: DDL, `BEGIN`, `COMMIT`, `ROLLBACK`.

#### Parameters

##### sql

`string`

##### params?

readonly `unknown`[]

#### Returns

`Promise`\<`void`\>

***

### close()

> **close**(): `Promise`\<`void`\>

Defined in: [plugins/sqlite/src/drivers/types.ts:35](https://github.com/Agrejus/routier/blob/main/plugins/sqlite/src/drivers/types.ts#L35)

Releases the connection. Called on every completion path, including failures.

#### Returns

`Promise`\<`void`\>

***

### defineFunction()?

> `optional` **defineFunction**(`name`, `implementation`): `void`

Defined in: [plugins/sqlite/src/drivers/types.ts:43](https://github.com/Agrejus/routier/blob/main/plugins/sqlite/src/drivers/types.ts#L43)

Replaces a built-in scalar function, deterministically.

SQLite refuses a non-deterministic function in an index expression, a CHECK, or a generated
column — and refuses to even load a schema that already has one.

#### Parameters

##### name

`string`

##### implementation

(...`args`) => `unknown`

#### Returns

`void`
