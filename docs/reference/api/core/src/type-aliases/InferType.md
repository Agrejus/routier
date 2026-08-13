[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / InferType

# Type Alias: InferType\<T\>

> **InferType**\<`T`\> = `T` *extends* [`CompiledSchema`](CompiledSchema.md)\<infer R\> ? `InferCompiledSchema`\<`R`\> : `T` *extends* `object` ? `InferCompiledSchema`\<`T`\> : `T`

Defined in: [core/src/schema/types.ts:377](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/types.ts#L377)

## Type Parameters

### T

`T`
