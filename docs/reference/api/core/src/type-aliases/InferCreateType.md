[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / InferCreateType

# Type Alias: InferCreateType\<T\>

> **InferCreateType**\<`T`\> = `T` *extends* [`CompiledSchema`](CompiledSchema.md)\<infer R\> ? `InferCompiledCreateSchema`\<`R`\> : `T` *extends* `object` ? `InferCompiledCreateSchema`\<`T`\> : `unknown`

Defined in: [core/src/schema/types.ts:378](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/schema/types.ts#L378)

## Type Parameters

### T

`T`
