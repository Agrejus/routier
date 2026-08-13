[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / DeepPartial

# Type Alias: DeepPartial\<T\>

> **DeepPartial**\<`T`\> = `T` *extends* `object` ? `{ [P in keyof T]?: DeepPartial<T[P]> }` : `T`

Defined in: [core/src/types/index.ts:1](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/types/index.ts#L1)

## Type Parameters

### T

`T`
