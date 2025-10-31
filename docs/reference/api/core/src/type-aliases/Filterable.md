[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / Filterable

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

> **filter**: [`CompositeFilter`](CompositeFilter.md)\<`T`, `P`\>

Defined in: [core/src/expressions/types.ts:181](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L181)

The filter function.

***

### params?

> `optional` **params**: `P`

Defined in: [core/src/expressions/types.ts:183](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L183)

Optional parameters for the filter.
