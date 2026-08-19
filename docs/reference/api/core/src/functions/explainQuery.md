[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / explainQuery

# Function: explainQuery()

> **explainQuery**(`options`, `context`): [`QueryExplanation`](../type-aliases/QueryExplanation.md)

Defined in: [core/src/plugins/query/explain.ts:253](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L253)

Builds the explanation from the resolved options, with no plugin involvement.

Takes the collection BEFORE `split()`, and throws otherwise. Splitting re-adds each half
into a fresh collection, which re-derives targets without the options that caused them — a
post-join filter alone in the memory half derives back to `"database"`, and the document
would report memory work as having run in the database.

## Parameters

### options

[`QueryOptionsCollection`](../classes/QueryOptionsCollection.md)\<`any`\>

### context

[`ExplainContext`](../type-aliases/ExplainContext.md)

## Returns

[`QueryExplanation`](../type-aliases/QueryExplanation.md)
