[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / QueryField

# Type Alias: QueryField

> **QueryField** = `object`

Defined in: [core/src/plugins/query/types.ts:15](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/types.ts#L15)

Field mapping for a query result, including source and destination names and a getter function.

## Properties

### sourceName

> **sourceName**: `string`

Defined in: [core/src/plugins/query/types.ts:16](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/types.ts#L16)

***

### destinationName

> **destinationName**: `string`

Defined in: [core/src/plugins/query/types.ts:17](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/types.ts#L17)

***

### isRename

> **isRename**: `boolean`

Defined in: [core/src/plugins/query/types.ts:18](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/types.ts#L18)

***

### property?

> `optional` **property**: [`PropertyInfo`](../classes/PropertyInfo.md)\<`unknown`\>

Defined in: [core/src/plugins/query/types.ts:20](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/types.ts#L20)

The property the field's value is read from, when it reads exactly one.

***

### reads?

> `optional` **reads**: [`PropertyInfo`](../classes/PropertyInfo.md)\<`unknown`\>[]

Defined in: [core/src/plugins/query/types.ts:22](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/types.ts#L22)

Every property the field's value is read from. Absent when the selector could not be parsed.

***

### isDirectProperty?

> `optional` **isDirectProperty**: `boolean`

Defined in: [core/src/plugins/query/types.ts:28](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/types.ts#L28)

`false` when the value is computed from `property` rather than being it, as in `x.createdDate.getTime()`,
or when the selector could not be parsed. Absent on a field built from a property rather than a
selector, which is that property.

***

### getter()

> **getter**: \<`T`\>(`data`) => `T`

Defined in: [core/src/plugins/query/types.ts:29](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/types.ts#L29)

#### Type Parameters

##### T

`T`

#### Parameters

##### data

`Record`\<`string`, `unknown`\>

#### Returns

`T`
