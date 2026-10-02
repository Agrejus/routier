[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/tanstack-query/src](../README.md) / LiveQueryOptions

# Type Alias: LiveQueryOptions\<T, TKey\>

> **LiveQueryOptions**\<`T`, `TKey`\> = `object`

Defined in: [plugins/tanstack-query/src/liveQueryOptions.ts:7](https://github.com/Agrejus/routier/blob/main/plugins/tanstack-query/src/liveQueryOptions.ts#L7)

## Type Parameters

### T

`T`

### TKey

`TKey` *extends* `QueryKey`

## Properties

### queryKey

> **queryKey**: `TKey`

Defined in: [plugins/tanstack-query/src/liveQueryOptions.ts:8](https://github.com/Agrejus/routier/blob/main/plugins/tanstack-query/src/liveQueryOptions.ts#L8)

***

### queryFn()

> **queryFn**: (`context`) => `Promise`\<`T`\>

Defined in: [plugins/tanstack-query/src/liveQueryOptions.ts:9](https://github.com/Agrejus/routier/blob/main/plugins/tanstack-query/src/liveQueryOptions.ts#L9)

#### Parameters

##### context

`QueryFunctionContext`\<`TKey`\>

#### Returns

`Promise`\<`T`\>

***

### staleTime

> **staleTime**: `number`

Defined in: [plugins/tanstack-query/src/liveQueryOptions.ts:10](https://github.com/Agrejus/routier/blob/main/plugins/tanstack-query/src/liveQueryOptions.ts#L10)
