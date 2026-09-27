[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / InferType

# Type Alias: InferType\<T\>

> **InferType**\<`T`\> = `T` *extends* [`CompiledSchema`](CompiledSchema.md)\<infer R\> ? `InferCompiledSchema`\<`R`\> : `T` *extends* `object` ? `InferCompiledSchema`\<`T`\> : `T`

Defined in: [core/src/schema/types.ts:387](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L387)

## Type Parameters

### T

`T`
