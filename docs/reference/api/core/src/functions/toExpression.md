[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / toExpression

# Function: toExpression()

> **toExpression**\<`T`, `P`\>(`schema`, `fn`, `params?`): [`Expression`](../classes/Expression.md)

Defined in: [core/src/expressions/parser.ts:123](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/parser.ts#L123)

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
