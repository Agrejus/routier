[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [lit/src](../README.md) / LiveQueryControllerOptions

# Type Alias: LiveQueryControllerOptions\<T, TArgs\>

> **LiveQueryControllerOptions**\<`T`, `TArgs`\> = \{ `query`: [`LiveQuery`](../../../react/src/type-aliases/LiveQuery.md)\<`T`\>; \} \| \{ `args`: () => `TArgs`; `query`: (`args`) => [`LiveQuery`](../../../react/src/type-aliases/LiveQuery.md)\<`T`\>; \}

Defined in: lit/src/LiveQueryController.ts:8

## Type Parameters

### T

`T`

### TArgs

`TArgs` *extends* readonly [`LiveQueryArgument`](LiveQueryArgument.md)[]
