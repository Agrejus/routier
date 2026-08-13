[**routier-collection**](/reference/api/README)

***

[routier-collection](/reference/api/README) / [core/src](/reference/api/core/src/README) / toExpression

# Function: toExpression()

> **toExpression**\<`T`, `P`\>(`schema`, `fn`, `params?`): [`Expression`](/reference/api/core/src/classes/Expression)

Defined in: [core/src/expressions/parser.ts:123](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/parser.ts#L123)

## Type Parameters

### T

`T` *extends* `unknown`

### P

`P` *extends* `unknown`

## Parameters

### schema

[`CompiledSchema`](/reference/api/core/src/type-aliases/CompiledSchema)\<`any`\>

### fn

[`Filter`](/reference/api/core/src/type-aliases/Filter)\<`T`\> | [`ParamsFilter`](/reference/api/core/src/type-aliases/ParamsFilter)\<`T`, `P`\>

### params?

`P`

## Returns

[`Expression`](/reference/api/core/src/classes/Expression)
