[**routier-collection**](/reference/api/README)

***

[routier-collection](/reference/api/README) / [core/src](/reference/api/core/src/README) / InferCreateType

# Type Alias: InferCreateType\<T\>

> **InferCreateType**\<`T`\> = `T` *extends* [`CompiledSchema`](/reference/api/core/src/type-aliases/CompiledSchema)\<infer R\> ? `InferCompiledCreateSchema`\<`R`\> : `T` *extends* `object` ? `InferCompiledCreateSchema`\<`T`\> : `unknown`

Defined in: [core/src/schema/types.ts:186](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L186)

## Type Parameters

### T

`T`
