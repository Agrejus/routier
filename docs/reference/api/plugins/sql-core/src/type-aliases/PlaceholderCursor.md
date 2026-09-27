[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sql-core/src](../README.md) / PlaceholderCursor

# Type Alias: PlaceholderCursor

> **PlaceholderCursor** = `object`

Defined in: [plugins/sql-core/src/sql.ts:635](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L635)

The placeholder counter, as something a nested render can read and advance.

`params.length` is not the same number once an outer statement passed a `paramOffset` — a join
does — and a nested render that starts at the wrong index numbers every placeholder after it wrong.

## Methods

### next()

> **next**(): `string`

Defined in: [plugins/sql-core/src/sql.ts:636](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L636)

#### Returns

`string`

***

### at()

> **at**(): `number`

Defined in: [plugins/sql-core/src/sql.ts:637](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L637)

#### Returns

`number`

***

### skip()

> **skip**(`count`): `void`

Defined in: [plugins/sql-core/src/sql.ts:638](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/sql.ts#L638)

#### Parameters

##### count

`number`

#### Returns

`void`
