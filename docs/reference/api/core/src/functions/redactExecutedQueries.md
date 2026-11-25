[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / redactExecutedQueries

# Function: redactExecutedQueries()

> **redactExecutedQueries**(`queries`, `hide`): [`ExecutedQuery`](../type-aliases/ExecutedQuery.md)[]

Defined in: [core/src/plugins/query/redactQueries.ts:18](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/redactQueries.ts#L18)

The statements a plugin ran, with their values hidden when the query filters on a sensitive
property. A statement with separate parameters keeps its text, whose placeholders show no
values. A statement without them carries its values inline, so its text is hidden.

## Parameters

### queries

[`ExecutedQuery`](../type-aliases/ExecutedQuery.md)[]

### hide

`boolean`

## Returns

[`ExecutedQuery`](../type-aliases/ExecutedQuery.md)[]
