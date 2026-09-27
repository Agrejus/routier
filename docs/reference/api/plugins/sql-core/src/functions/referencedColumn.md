[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sql-core/src](../README.md) / referencedColumn

# Function: referencedColumn()

> **referencedColumn**(`property`, `name`, `dialect`): `string`

Defined in: [plugins/sql-core/src/columns.ts:291](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/columns.ts#L291)

The column a sort or aggregate names: the property's storage column when there is a property,
otherwise the name as recorded.

The recorded name is the IN-MEMORY path, so emitting it for a property is how a renamed column
became `ORDER BY "displayName"` against a table whose column is `display_name`.

## Parameters

### property

`PropertyInfo`\<`any`\>

### name

`string`

### dialect

[`SqlDialect`](../interfaces/SqlDialect.md)

## Returns

`string`
