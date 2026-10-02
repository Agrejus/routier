[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sql-core/src](../README.md) / buildGroupedUpdateOperations

# Function: buildGroupedUpdateOperations()

> **buildGroupedUpdateOperations**\<`T`\>(`schema`, `updates`, `dialect`, `options?`): [`GroupedUpdateOperation`](../type-aliases/GroupedUpdateOperation.md)[]

Defined in: [plugins/sql-core/src/updates.ts:171](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/updates.ts#L171)

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

#### etag?

[`SqlEtag`](../type-aliases/SqlEtag.md)

## Returns

[`GroupedUpdateOperation`](../type-aliases/GroupedUpdateOperation.md)[]
