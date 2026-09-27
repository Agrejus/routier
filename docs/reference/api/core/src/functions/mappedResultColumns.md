[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / mappedResultColumns

# Function: mappedResultColumns()

> **mappedResultColumns**(`fields`): [`ResultColumn`](../type-aliases/ResultColumn.md)[]

Defined in: [core/src/plugins/resultShape.ts:37](https://github.com/Agrejus/routier/blob/main/core/src/plugins/resultShape.ts#L37)

The columns a `map` projection selects.

Named by `sourceName`, which is what the statement actually emits; the rename to
`destinationName` happens in the translator, after the rows come back. A field with no
`property` is an expression.

## Parameters

### fields

readonly [`QueryField`](../type-aliases/QueryField.md)[]

## Returns

[`ResultColumn`](../type-aliases/ResultColumn.md)[]
