[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [react/src](../README.md) / LiveQueryState

# Type Alias: LiveQueryState\<T\>

> **LiveQueryState**\<`T`\> = \{ `status`: `"pending"`; `loading`: `true`; `isSuccess`: `false`; `isError`: `false`; \} \| \{ `status`: `"error"`; `loading`: `false`; `error`: `Error`; `isSuccess`: `false`; `isError`: `true`; \} \| \{ `status`: `"success"`; `loading`: `false`; `data`: `T`; `isSuccess`: `true`; `isError`: `false`; \}

Defined in: [react/src/useQuery.tsx:4](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/react/src/useQuery.tsx#L4)

## Type Parameters

### T

`T`
