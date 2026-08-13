[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / ReadonlySchemaCollection

# Class: ReadonlySchemaCollection

Defined in: [core/src/collections/ReadonlySchemaCollection.ts:6](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/collections/ReadonlySchemaCollection.ts#L6)

Collection of schemas with generic typing for type-safe schema retrieval

## Extended by

- [`SchemaCollection`](SchemaCollection.md)

## Constructors

### Constructor

> **new ReadonlySchemaCollection**(`data?`): `ReadonlySchemaCollection`

Defined in: [core/src/collections/ReadonlySchemaCollection.ts:10](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/collections/ReadonlySchemaCollection.ts#L10)

#### Parameters

##### data?

\[[`SchemaId`](../type-aliases/SchemaId.md), [`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`Record`\<`string`, `unknown`\>\>\][]

#### Returns

`ReadonlySchemaCollection`

## Accessors

### size

#### Get Signature

> **get** **size**(): `number`

Defined in: [core/src/collections/ReadonlySchemaCollection.ts:22](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/collections/ReadonlySchemaCollection.ts#L22)

##### Returns

`number`

## Methods

### get()

> **get**\<`T`\>(`schemaId`): [`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`T`\>

Defined in: [core/src/collections/ReadonlySchemaCollection.ts:14](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/collections/ReadonlySchemaCollection.ts#L14)

#### Type Parameters

##### T

`T`

#### Parameters

##### schemaId

[`SchemaId`](../type-aliases/SchemaId.md)

#### Returns

[`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`T`\>

***

### has()

> **has**(`schemaId`): `boolean`

Defined in: [core/src/collections/ReadonlySchemaCollection.ts:18](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/collections/ReadonlySchemaCollection.ts#L18)

#### Parameters

##### schemaId

[`SchemaId`](../type-aliases/SchemaId.md)

#### Returns

`boolean`

***

### keys()

> **keys**(): `IterableIterator`\<[`SchemaId`](../type-aliases/SchemaId.md)\>

Defined in: [core/src/collections/ReadonlySchemaCollection.ts:26](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/collections/ReadonlySchemaCollection.ts#L26)

#### Returns

`IterableIterator`\<[`SchemaId`](../type-aliases/SchemaId.md)\>

***

### values()

> **values**(): `IterableIterator`\<[`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`Record`\<`string`, `unknown`\>\>\>

Defined in: [core/src/collections/ReadonlySchemaCollection.ts:30](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/collections/ReadonlySchemaCollection.ts#L30)

#### Returns

`IterableIterator`\<[`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`Record`\<`string`, `unknown`\>\>\>

***

### entries()

> **entries**(): `IterableIterator`\<\[[`SchemaId`](../type-aliases/SchemaId.md), [`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`Record`\<`string`, `unknown`\>\>\]\>

Defined in: [core/src/collections/ReadonlySchemaCollection.ts:34](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/collections/ReadonlySchemaCollection.ts#L34)

#### Returns

`IterableIterator`\<\[[`SchemaId`](../type-aliases/SchemaId.md), [`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`Record`\<`string`, `unknown`\>\>\]\>

***

### forEach()

> **forEach**(`callbackfn`, `thisArg?`): `void`

Defined in: [core/src/collections/ReadonlySchemaCollection.ts:38](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/collections/ReadonlySchemaCollection.ts#L38)

#### Parameters

##### callbackfn

(`value`, `key`, `map`) => `void`

##### thisArg?

`any`

#### Returns

`void`

***

### \[iterator\]()

> **\[iterator\]**(): `IterableIterator`\<\[[`SchemaId`](../type-aliases/SchemaId.md), [`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`Record`\<`string`, `unknown`\>\>\]\>

Defined in: [core/src/collections/ReadonlySchemaCollection.ts:42](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/collections/ReadonlySchemaCollection.ts#L42)

#### Returns

`IterableIterator`\<\[[`SchemaId`](../type-aliases/SchemaId.md), [`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`Record`\<`string`, `unknown`\>\>\]\>

***

### getByName()

> **getByName**\<`T`\>(`collectionName`): [`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`T`\>

Defined in: [core/src/collections/ReadonlySchemaCollection.ts:46](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/collections/ReadonlySchemaCollection.ts#L46)

#### Type Parameters

##### T

`T`

#### Parameters

##### collectionName

`string`

#### Returns

[`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`T`\>
