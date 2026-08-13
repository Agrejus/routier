[**routier-collection**](../../../../../../README.md)

***

[routier-collection](../../../../../../README.md) / [plugins/sqlite/src/drivers/turso](../README.md) / LibsqlClientLike

# Type Alias: LibsqlClientLike

> **LibsqlClientLike** = `object`

Defined in: [plugins/sqlite/src/drivers/turso.ts:69](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sqlite/src/drivers/turso.ts#L69)

## Methods

### execute()

> **execute**(`statement`): `Promise`\<`LibsqlResult`\>

Defined in: [plugins/sqlite/src/drivers/turso.ts:70](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sqlite/src/drivers/turso.ts#L70)

#### Parameters

##### statement

`LibsqlStatement`

#### Returns

`Promise`\<`LibsqlResult`\>

***

### transaction()

> **transaction**(`mode`): `Promise`\<`LibsqlTransaction`\>

Defined in: [plugins/sqlite/src/drivers/turso.ts:71](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sqlite/src/drivers/turso.ts#L71)

#### Parameters

##### mode

`"write"` | `"read"` | `"deferred"`

#### Returns

`Promise`\<`LibsqlTransaction`\>

***

### close()

> **close**(): `void`

Defined in: [plugins/sqlite/src/drivers/turso.ts:72](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sqlite/src/drivers/turso.ts#L72)

#### Returns

`void`
