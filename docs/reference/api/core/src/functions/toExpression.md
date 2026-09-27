[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / toExpression

# Function: toExpression()

> **toExpression**\<`T`, `P`\>(`schema`, `fn`, `params?`): [`Expression`](../classes/Expression.md)

Defined in: [core/src/expressions/parser.ts:2583](https://github.com/Agrejus/routier/blob/main/core/src/expressions/parser.ts#L2583)

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
