[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/lit/src](../README.md) / LiveQueryControllerOptions

# Type Alias: LiveQueryControllerOptions\<T, TArgs\>

> **LiveQueryControllerOptions**\<`T`, `TArgs`\> = \{ `query`: [`LiveQuery`](../../../react/src/type-aliases/LiveQuery.md)\<`T`\>; \} \| \{ `args`: () => `TArgs`; `query`: (`args`) => [`LiveQuery`](../../../react/src/type-aliases/LiveQuery.md)\<`T`\>; \}

Defined in: [plugins/lit/src/LiveQueryController.ts:8](https://github.com/Agrejus/routier/blob/main/plugins/lit/src/LiveQueryController.ts#L8)

## Type Parameters

### T

`T`

### TArgs

`TArgs` *extends* readonly [`LiveQueryArgument`](LiveQueryArgument.md)[]
