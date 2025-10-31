[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / InferType

# Type Alias: InferType\<T\>

> **InferType**\<`T`\> = `T` *extends* [`CompiledSchema`](CompiledSchema.md)\<infer R\> ? `InferCompiledSchema`\<`R`\> : `T` *extends* `object` ? `InferCompiledSchema`\<`T`\> : `T`

Defined in: [core/src/schema/types.ts:185](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L185)

## Type Parameters

### T

`T`
