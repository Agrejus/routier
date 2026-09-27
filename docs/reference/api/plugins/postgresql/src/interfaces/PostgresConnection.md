[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/postgresql/src](../README.md) / PostgresConnection

# Interface: PostgresConnection

Defined in: plugins/postgres-core/dist/drivers/types.d.ts:15

One connection, held for the length of a single query or a single save.

## Methods

### all()

> **all**(`sql`, `params?`, `result?`): `Promise`\<`unknown`[]\>

Defined in: plugins/postgres-core/dist/drivers/types.d.ts:27

`result` describes the columns the statement returns, in order, and is a HINT: every driver
may ignore it and return the same rows, which is what every server-backed one does. A driver
that pays to move rows across a worker boundary can encode them columnar instead.

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

Defined in: plugins/postgres-core/dist/drivers/types.d.ts:29

Runs a statement whose rows are not wanted: DDL, `BEGIN`, `COMMIT`, `SAVEPOINT`.

#### Parameters

##### sql

`string`

##### params?

readonly `unknown`[]

#### Returns

`Promise`\<`void`\>

***

### release()

> **release**(): `Promise`\<`void`\>

Defined in: plugins/postgres-core/dist/drivers/types.d.ts:31

Returns the connection to its driver. Called on every path, including failures.

#### Returns

`Promise`\<`void`\>
