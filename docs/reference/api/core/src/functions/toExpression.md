[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / toExpression

# Function: toExpression()

> **toExpression**\<`T`, `P`\>(`schema`, `fn`, `params?`): [`Expression`](../classes/Expression.md)

Defined in: [core/src/expressions/parser.ts:1291](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/expressions/parser.ts#L1291)

## Type Parameters

### T

`T` *extends* `unknown`

### P

`P` *extends* `unknown`

## Parameters

### schema

[`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`any`\>

### fn

[`Filter`](../type-aliases/Filter.md)\<`T`\> | [`ParamsFilter`](../type-aliases/ParamsFilter.md)\<`T`, `P`\>

### params?

`P`

## Returns

[`Expression`](../classes/Expression.md)
