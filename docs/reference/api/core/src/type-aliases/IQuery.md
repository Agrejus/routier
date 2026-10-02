[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / IQuery

# Type Alias: IQuery\<TRoot, TShape\>

> **IQuery**\<`TRoot`, `TShape`\> = `object`

Defined in: [core/src/plugins/types.ts:226](https://github.com/Agrejus/routier/blob/main/core/src/plugins/types.ts#L226)

Interface for a query operation, including expression, options, filters, and change tracking.

## Type Parameters

### TRoot

`TRoot` *extends* `object`

### TShape

`TShape`

## Properties

### options

> **options**: [`QueryOptionsCollection`](../classes/QueryOptionsCollection.md)\<`TShape`\>

Defined in: [core/src/plugins/types.ts:229](https://github.com/Agrejus/routier/blob/main/core/src/plugins/types.ts#L229)

Query options (sort, skip, take, etc.).

***

### schema

> **schema**: [`CompiledSchema`](CompiledSchema.md)\<`TRoot`\>

Defined in: [core/src/plugins/types.ts:231](https://github.com/Agrejus/routier/blob/main/core/src/plugins/types.ts#L231)

## Accessors

### changeTracking

#### Get Signature

> **get** **changeTracking**(): `boolean`

Defined in: [core/src/plugins/types.ts:236](https://github.com/Agrejus/routier/blob/main/core/src/plugins/types.ts#L236)

Whether change tracking is enabled for the query result.
Only enabled when the response is not reduced/aggregated/mapped.

##### Returns

`boolean`
