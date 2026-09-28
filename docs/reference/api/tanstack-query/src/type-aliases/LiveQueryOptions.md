[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [tanstack-query/src](../README.md) / LiveQueryOptions

# Type Alias: LiveQueryOptions\<T, TKey\>

> **LiveQueryOptions**\<`T`, `TKey`\> = `object`

Defined in: tanstack-query/src/liveQueryOptions.ts:7

## Type Parameters

### T

`T`

### TKey

`TKey` *extends* `QueryKey`

## Properties

### queryKey

> **queryKey**: `TKey`

Defined in: tanstack-query/src/liveQueryOptions.ts:8

***

### queryFn()

> **queryFn**: (`context`) => `Promise`\<`T`\>

Defined in: tanstack-query/src/liveQueryOptions.ts:9

#### Parameters

##### context

`QueryFunctionContext`\<`TKey`\>

#### Returns

`Promise`\<`T`\>

***

### staleTime

> **staleTime**: `number`

Defined in: tanstack-query/src/liveQueryOptions.ts:10
