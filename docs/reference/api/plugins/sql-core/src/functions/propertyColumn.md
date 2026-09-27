[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sql-core/src](../README.md) / propertyColumn

# Function: propertyColumn()

> **propertyColumn**(`property`, `dialect`, `alias?`): `string`

Defined in: [plugins/sql-core/src/columns.ts:266](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/columns.ts#L266)

The column a property is stored in, or the JSON path into it when the property is nested.

Every segment is read through `.from()`. `getResolvedName()` alone is the LEAF name, which is a
real column only for a root property: `payload.operand.value` is stored in a `payload` JSON
column, and the rest of the chain is a path inside it.

The alias qualifies the ROOT identifier only, because the alias belongs on the column the JSON
lives in — `"o"."nested" -> '$.inner'` — not on the path inside it.

## Parameters

### property

`PropertyInfo`\<`any`\>

### dialect

[`SqlDialect`](../interfaces/SqlDialect.md)

### alias?

`string`

## Returns

`string`
