[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sqlite/src](../README.md) / SqliteConnection

# Interface: SqliteConnection

Defined in: [plugins/sqlite/src/drivers/types.ts:12](https://github.com/Agrejus/routier/blob/main/plugins/sqlite/src/drivers/types.ts#L12)

One open connection. The plugin opens one per operation and closes it on every path.

## Methods

### all()

> **all**(`sql`, `params?`): `Promise`\<`unknown`[]\>

Defined in: [plugins/sqlite/src/drivers/types.ts:19](https://github.com/Agrejus/routier/blob/main/plugins/sqlite/src/drivers/types.ts#L19)

Runs a statement and returns its rows.

Used for `SELECT` and for writes with `RETURNING`, which is how the plugin echoes saved
rows back to the change tracker.

#### Parameters

##### sql

`string`

##### params?

readonly `unknown`[]

#### Returns

`Promise`\<`unknown`[]\>

***

### run()

> **run**(`sql`, `params?`): `Promise`\<`void`\>

Defined in: [plugins/sqlite/src/drivers/types.ts:22](https://github.com/Agrejus/routier/blob/main/plugins/sqlite/src/drivers/types.ts#L22)

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

Defined in: [plugins/sqlite/src/drivers/types.ts:25](https://github.com/Agrejus/routier/blob/main/plugins/sqlite/src/drivers/types.ts#L25)

Releases the connection. Called on every completion path, including failures.

#### Returns

`Promise`\<`void`\>
