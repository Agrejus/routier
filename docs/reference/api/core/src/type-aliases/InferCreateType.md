[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / InferCreateType

# Type Alias: InferCreateType\<T\>

> **InferCreateType**\<`T`\> = `T` *extends* [`CompiledSchema`](CompiledSchema.md)\<infer R\> ? `InferCompiledCreateSchema`\<`R`\> : `T` *extends* `object` ? `InferCompiledCreateSchema`\<`T`\> : `unknown`

Defined in: [core/src/schema/types.ts:378](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L378)

## Type Parameters

### T

`T`
