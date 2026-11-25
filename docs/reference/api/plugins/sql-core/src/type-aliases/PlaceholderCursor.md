[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sql-core/src](../README.md) / PlaceholderCursor

# Type Alias: PlaceholderCursor

> **PlaceholderCursor** = `object`

Defined in: [plugins/sql-core/src/sql.ts:657](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L657)

The placeholder counter, as something a nested render can read and advance.

`params.length` is not the same number once an outer statement passed a `paramOffset` — a join
does — and a nested render that starts at the wrong index numbers every placeholder after it wrong.

## Methods

### next()

> **next**(): `string`

Defined in: [plugins/sql-core/src/sql.ts:658](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L658)

#### Returns

`string`

***

### at()

> **at**(): `number`

Defined in: [plugins/sql-core/src/sql.ts:659](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L659)

#### Returns

`number`

***

### skip()

> **skip**(`count`): `void`

Defined in: [plugins/sql-core/src/sql.ts:660](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L660)

#### Parameters

##### count

`number`

#### Returns

`void`
