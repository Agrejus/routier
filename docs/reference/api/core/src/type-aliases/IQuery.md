[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / IQuery

# Type Alias: IQuery\<TRoot, TShape\>

> **IQuery**\<`TRoot`, `TShape`\> = `object`

Defined in: [core/src/plugins/types.ts:182](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/types.ts#L182)

Interface for a query operation, including expression, options, filters, and change tracking.

## Type Parameters

### TRoot

`TRoot` *extends* `object`

### TShape

`TShape`

## Properties

### options

> **options**: [`QueryOptionsCollection`](../classes/QueryOptionsCollection.md)\<`TShape`\>

Defined in: [core/src/plugins/types.ts:185](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/types.ts#L185)

Query options (sort, skip, take, etc.).

***

### schema

> **schema**: [`CompiledSchema`](CompiledSchema.md)\<`TRoot`\>

Defined in: [core/src/plugins/types.ts:187](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/types.ts#L187)

## Accessors

### changeTracking

#### Get Signature

> **get** **changeTracking**(): `boolean`

Defined in: [core/src/plugins/types.ts:192](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/types.ts#L192)

Whether change tracking is enabled for the query result.
Only enabled when the response is not reduced/aggregated/mapped.

##### Returns

`boolean`
