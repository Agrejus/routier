[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / toExpression

# Function: toExpression()

> **toExpression**\<`T`, `P`\>(`schema`, `fn`, `params?`): [`Expression`](../classes/Expression.md)

Defined in: [core/src/expressions/parser.ts:1291](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/expressions/parser.ts#L1291)

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
