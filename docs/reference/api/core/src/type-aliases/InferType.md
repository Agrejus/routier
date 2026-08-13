[**routier-collection**](/reference/api/README)

***

[routier-collection](/reference/api/README) / [core/src](/reference/api/core/src/README) / InferType

# Type Alias: InferType\<T\>

> **InferType**\<`T`\> = `T` *extends* [`CompiledSchema`](/reference/api/core/src/type-aliases/CompiledSchema)\<infer R\> ? `InferCompiledSchema`\<`R`\> : `T` *extends* `object` ? `InferCompiledSchema`\<`T`\> : `T`

Defined in: [core/src/schema/types.ts:185](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L185)

## Type Parameters

### T

`T`
