[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sql-core/src](../README.md) / buildConditionalUpdateOperations

# Function: buildConditionalUpdateOperations()

> **buildConditionalUpdateOperations**\<`T`\>(`schema`, `updates`, `dialect`, `options?`): [`ConditionalUpdateOperation`](../type-aliases/ConditionalUpdateOperation.md)[]

Defined in: [plugins/sql-core/src/updates.ts:94](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/sql-core/src/updates.ts#L94)

## Type Parameters

### T

`T` *extends* `object`

## Parameters

### schema

`CompiledSchema`\<`T`\>

### updates

readonly [`EntityUpdate`](../type-aliases/EntityUpdate.md)[]

### dialect

[`SqlDialect`](../interfaces/SqlDialect.md)

### options?

#### suffix?

`string`

## Returns

[`ConditionalUpdateOperation`](../type-aliases/ConditionalUpdateOperation.md)[]
