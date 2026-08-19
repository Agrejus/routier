[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / formatExplanation

# Function: formatExplanation()

> **formatExplanation**(`explanation`): `string`

Defined in: [core/src/plugins/query/formatExplanation.ts:168](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/query/formatExplanation.ts#L168)

Renders an explanation for a terminal.

The STEP headers carry the whole lesson: a reader who has never heard of pushdown still sees
that the statement in step 1 is not the entire query. Nobody should have to notice a missing
ORDER BY to work that out.

## Parameters

### explanation

[`QueryExplanation`](../type-aliases/QueryExplanation.md)

## Returns

`string`
