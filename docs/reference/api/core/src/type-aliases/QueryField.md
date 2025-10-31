[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / QueryField

# Type Alias: QueryField

> **QueryField** = `object`

Defined in: [core/src/plugins/query/types.ts:13](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/types.ts#L13)

Field mapping for a query result, including source and destination names and a getter function.

## Properties

### sourceName

> **sourceName**: `string`

Defined in: [core/src/plugins/query/types.ts:14](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/types.ts#L14)

***

### destinationName

> **destinationName**: `string`

Defined in: [core/src/plugins/query/types.ts:15](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/types.ts#L15)

***

### isRename

> **isRename**: `boolean`

Defined in: [core/src/plugins/query/types.ts:16](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/types.ts#L16)

***

### property?

> `optional` **property**: [`PropertyInfo`](../classes/PropertyInfo.md)\<`unknown`\>

Defined in: [core/src/plugins/query/types.ts:17](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/types.ts#L17)

***

### getter()

> **getter**: \<`T`\>(`data`) => `T`

Defined in: [core/src/plugins/query/types.ts:18](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/query/types.ts#L18)

#### Type Parameters

##### T

`T`

#### Parameters

##### data

`Record`\<`string`, `unknown`\>

#### Returns

`T`
