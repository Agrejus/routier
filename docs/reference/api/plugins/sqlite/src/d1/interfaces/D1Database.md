[**routier-collection**](../../../../../README.md)

***

[routier-collection](../../../../../README.md) / [plugins/sqlite/src/d1](../README.md) / D1Database

# Interface: D1Database

Defined in: [plugins/sqlite/src/d1.ts:64](https://github.com/Agrejus/routier/blob/main/plugins/sqlite/src/d1.ts#L64)

The subset of Cloudflare's `D1Database` this plugin uses.

## Methods

### prepare()

> **prepare**(`sql`): [`D1PreparedStatement`](D1PreparedStatement.md)

Defined in: [plugins/sqlite/src/d1.ts:65](https://github.com/Agrejus/routier/blob/main/plugins/sqlite/src/d1.ts#L65)

#### Parameters

##### sql

`string`

#### Returns

[`D1PreparedStatement`](D1PreparedStatement.md)

***

### batch()

> **batch**\<`T`\>(`statements`): `Promise`\<`object`[]\>

Defined in: [plugins/sqlite/src/d1.ts:72](https://github.com/Agrejus/routier/blob/main/plugins/sqlite/src/d1.ts#L72)

Runs every statement as ONE transaction: all of them apply, or none does.

A failure rejects and rolls the whole sequence back, which is the property this plugin
depends on for a multi-statement save.

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### statements

[`D1PreparedStatement`](D1PreparedStatement.md)[]

#### Returns

`Promise`\<`object`[]\>
