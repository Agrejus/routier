[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / IQuery

# Type Alias: IQuery\<TRoot, TShape\>

> **IQuery**\<`TRoot`, `TShape`\> = `object`

Defined in: [core/src/plugins/types.ts:104](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/types.ts#L104)

Interface for a query operation, including expression, options, filters, and change tracking.

## Type Parameters

### TRoot

`TRoot` *extends* `object`

### TShape

`TShape`

## Properties

### options

> **options**: [`QueryOptionsCollection`](../classes/QueryOptionsCollection.md)\<`TShape`\>

Defined in: [core/src/plugins/types.ts:107](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/types.ts#L107)

Query options (sort, skip, take, etc.).

***

### schema

> **schema**: [`CompiledSchema`](CompiledSchema.md)\<`TRoot`\>

Defined in: [core/src/plugins/types.ts:109](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/types.ts#L109)

## Accessors

### changeTracking

#### Get Signature

> **get** **changeTracking**(): `boolean`

Defined in: [core/src/plugins/types.ts:114](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/types.ts#L114)

Whether change tracking is enabled for the query result.
Only enabled when the response is not reduced/aggregated/mapped.

##### Returns

`boolean`
