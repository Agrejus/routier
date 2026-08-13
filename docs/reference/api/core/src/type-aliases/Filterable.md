[**routier-collection**](/reference/api/README)

***

[routier-collection](/reference/api/README) / [core/src](/reference/api/core/src/README) / Filterable

# Type Alias: Filterable\<T, P\>

> **Filterable**\<`T`, `P`\> = `object`

Defined in: [core/src/expressions/types.ts:179](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L179)

An object that can be filtered using a composite filter and optional parameters.

## Type Parameters

### T

`T` *extends* `any`

### P

`P` = `any`

## Properties

### filter

> **filter**: [`CompositeFilter`](/reference/api/core/src/type-aliases/CompositeFilter)\<`T`, `P`\>

Defined in: [core/src/expressions/types.ts:181](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L181)

The filter function.

***

### params?

> `optional` **params**: `P`

Defined in: [core/src/expressions/types.ts:183](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L183)

Optional parameters for the filter.
