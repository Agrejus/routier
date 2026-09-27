[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / executedQueriesOf

# Function: executedQueriesOf()

> **executedQueriesOf**(`explanation`): [`ExecutedQuery`](../type-aliases/ExecutedQuery.md)[]

Defined in: [core/src/plugins/query/explain.ts:409](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/explain.ts#L409)

Every statement the query ran, across every database it touched, in execution order.

A step is a place, so the statements live on the steps — this is for a caller that wants them all
without caring which plugin ran which.

## Parameters

### explanation

[`QueryExplanation`](../type-aliases/QueryExplanation.md)

## Returns

[`ExecutedQuery`](../type-aliases/ExecutedQuery.md)[]
