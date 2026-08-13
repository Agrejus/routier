[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / QueryField

# Type Alias: QueryField

> **QueryField** = `object`

Defined in: [core/src/plugins/query/types.ts:15](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/query/types.ts#L15)

Field mapping for a query result, including source and destination names and a getter function.

## Properties

### sourceName

> **sourceName**: `string`

Defined in: [core/src/plugins/query/types.ts:16](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/query/types.ts#L16)

***

### destinationName

> **destinationName**: `string`

Defined in: [core/src/plugins/query/types.ts:17](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/query/types.ts#L17)

***

### isRename

> **isRename**: `boolean`

Defined in: [core/src/plugins/query/types.ts:18](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/query/types.ts#L18)

***

### property?

> `optional` **property**: [`PropertyInfo`](../classes/PropertyInfo.md)\<`unknown`\>

Defined in: [core/src/plugins/query/types.ts:19](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/query/types.ts#L19)

***

### getter()

> **getter**: \<`T`\>(`data`) => `T`

Defined in: [core/src/plugins/query/types.ts:20](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/query/types.ts#L20)

#### Type Parameters

##### T

`T`

#### Parameters

##### data

`Record`\<`string`, `unknown`\>

#### Returns

`T`
