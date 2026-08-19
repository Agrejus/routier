[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [react/src](../README.md) / LiveQueryState

# Type Alias: LiveQueryState\<T\>

> **LiveQueryState**\<`T`\> = \{ `status`: `"pending"`; `loading`: `true`; `isSuccess`: `false`; `isError`: `false`; \} \| \{ `status`: `"error"`; `loading`: `false`; `error`: `Error`; `isSuccess`: `false`; `isError`: `true`; \} \| \{ `status`: `"success"`; `loading`: `false`; `data`: `T`; `isSuccess`: `true`; `isError`: `false`; \}

Defined in: [react/src/useQuery.tsx:4](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/react/src/useQuery.tsx#L4)

## Type Parameters

### T

`T`
