[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [react/src](../README.md) / LiveQueryState

# Type Alias: LiveQueryState\<T\>

> **LiveQueryState**\<`T`\> = \{ `status`: `"pending"`; `loading`: `true`; `isSuccess`: `false`; `isError`: `false`; \} \| \{ `status`: `"error"`; `loading`: `false`; `error`: `Error`; `isSuccess`: `false`; `isError`: `true`; \} \| \{ `status`: `"success"`; `loading`: `false`; `data`: `T`; `isSuccess`: `true`; `isError`: `false`; \}

Defined in: core/dist/results/liveQuery.d.ts:3

## Type Parameters

### T

`T`
