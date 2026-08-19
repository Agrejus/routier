[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / ScopeInfo

# Type Alias: ScopeInfo\<TContext\>

> **ScopeInfo**\<`TContext`\> = `object`

Defined in: [core/src/plugins/wire/handler.ts:85](https://github.com/Agrejus/routier/blob/main/core/src/plugins/wire/handler.ts#L85)

What a scope hook is asked. One collection at a time, since each may be scoped differently.

## Type Parameters

### TContext

`TContext`

## Properties

### collectionName

> **collectionName**: `string`

Defined in: [core/src/plugins/wire/handler.ts:86](https://github.com/Agrejus/routier/blob/main/core/src/plugins/wire/handler.ts#L86)

***

### schema

> **schema**: [`CompiledSchema`](CompiledSchema.md)\<`any`\>

Defined in: [core/src/plugins/wire/handler.ts:87](https://github.com/Agrejus/routier/blob/main/core/src/plugins/wire/handler.ts#L87)

***

### context

> **context**: `TContext`

Defined in: [core/src/plugins/wire/handler.ts:88](https://github.com/Agrejus/routier/blob/main/core/src/plugins/wire/handler.ts#L88)

***

### action

> **action**: `"query"` \| `"persist"`

Defined in: [core/src/plugins/wire/handler.ts:89](https://github.com/Agrejus/routier/blob/main/core/src/plugins/wire/handler.ts#L89)
