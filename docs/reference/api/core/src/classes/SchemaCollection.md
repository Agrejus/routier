[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / SchemaCollection

# Class: SchemaCollection

Defined in: [core/src/collections/SchemaCollection.ts:7](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/collections/SchemaCollection.ts#L7)

Collection of schemas with generic typing for type-safe schema retrieval

## Extends

- [`ReadonlySchemaCollection`](ReadonlySchemaCollection.md)

## Constructors

### Constructor

> **new SchemaCollection**(`data?`): `SchemaCollection`

Defined in: [core/src/collections/ReadonlySchemaCollection.ts:10](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/collections/ReadonlySchemaCollection.ts#L10)

#### Parameters

##### data?

\[[`SchemaId`](../type-aliases/SchemaId.md), [`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`Record`\<`string`, `unknown`\>\>\][]

#### Returns

`SchemaCollection`

#### Inherited from

[`ReadonlySchemaCollection`](ReadonlySchemaCollection.md).[`constructor`](ReadonlySchemaCollection.md#constructor)

## Accessors

### size

#### Get Signature

> **get** **size**(): `number`

Defined in: [core/src/collections/ReadonlySchemaCollection.ts:22](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/collections/ReadonlySchemaCollection.ts#L22)

##### Returns

`number`

#### Inherited from

[`ReadonlySchemaCollection`](ReadonlySchemaCollection.md).[`size`](ReadonlySchemaCollection.md#size)

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

#### Inherited from

[`ReadonlySchemaCollection`](ReadonlySchemaCollection.md).[`get`](ReadonlySchemaCollection.md#get)

***

### has()

> **has**(`schemaId`): `boolean`

Defined in: [core/src/collections/ReadonlySchemaCollection.ts:18](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/collections/ReadonlySchemaCollection.ts#L18)

#### Parameters

##### schemaId

[`SchemaId`](../type-aliases/SchemaId.md)

#### Returns

`boolean`

#### Inherited from

[`ReadonlySchemaCollection`](ReadonlySchemaCollection.md).[`has`](ReadonlySchemaCollection.md#has)

***

### keys()

> **keys**(): `IterableIterator`\<[`SchemaId`](../type-aliases/SchemaId.md)\>

Defined in: [core/src/collections/ReadonlySchemaCollection.ts:26](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/collections/ReadonlySchemaCollection.ts#L26)

#### Returns

`IterableIterator`\<[`SchemaId`](../type-aliases/SchemaId.md)\>

#### Inherited from

[`ReadonlySchemaCollection`](ReadonlySchemaCollection.md).[`keys`](ReadonlySchemaCollection.md#keys)

***

### values()

> **values**(): `IterableIterator`\<[`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`Record`\<`string`, `unknown`\>\>\>

Defined in: [core/src/collections/ReadonlySchemaCollection.ts:30](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/collections/ReadonlySchemaCollection.ts#L30)

#### Returns

`IterableIterator`\<[`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`Record`\<`string`, `unknown`\>\>\>

#### Inherited from

[`ReadonlySchemaCollection`](ReadonlySchemaCollection.md).[`values`](ReadonlySchemaCollection.md#values)

***

### entries()

> **entries**(): `IterableIterator`\<\[[`SchemaId`](../type-aliases/SchemaId.md), [`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`Record`\<`string`, `unknown`\>\>\]\>

Defined in: [core/src/collections/ReadonlySchemaCollection.ts:34](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/collections/ReadonlySchemaCollection.ts#L34)

#### Returns

`IterableIterator`\<\[[`SchemaId`](../type-aliases/SchemaId.md), [`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`Record`\<`string`, `unknown`\>\>\]\>

#### Inherited from

[`ReadonlySchemaCollection`](ReadonlySchemaCollection.md).[`entries`](ReadonlySchemaCollection.md#entries)

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

#### Inherited from

[`ReadonlySchemaCollection`](ReadonlySchemaCollection.md).[`forEach`](ReadonlySchemaCollection.md#foreach)

***

### \[iterator\]()

> **\[iterator\]**(): `IterableIterator`\<\[[`SchemaId`](../type-aliases/SchemaId.md), [`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`Record`\<`string`, `unknown`\>\>\]\>

Defined in: [core/src/collections/ReadonlySchemaCollection.ts:42](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/collections/ReadonlySchemaCollection.ts#L42)

#### Returns

`IterableIterator`\<\[[`SchemaId`](../type-aliases/SchemaId.md), [`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`Record`\<`string`, `unknown`\>\>\]\>

#### Inherited from

[`ReadonlySchemaCollection`](ReadonlySchemaCollection.md).[`[iterator]`](ReadonlySchemaCollection.md#iterator)

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

#### Inherited from

[`ReadonlySchemaCollection`](ReadonlySchemaCollection.md).[`getByName`](ReadonlySchemaCollection.md#getbyname)

***

### set()

> **set**\<`T`\>(`schemaId`, `schema`): `this`

Defined in: [core/src/collections/SchemaCollection.ts:9](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/collections/SchemaCollection.ts#L9)

#### Type Parameters

##### T

`T`

#### Parameters

##### schemaId

[`SchemaId`](../type-aliases/SchemaId.md)

##### schema

[`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`T`\>

#### Returns

`this`

***

### delete()

> **delete**(`schemaId`): `boolean`

Defined in: [core/src/collections/SchemaCollection.ts:14](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/collections/SchemaCollection.ts#L14)

#### Parameters

##### schemaId

[`SchemaId`](../type-aliases/SchemaId.md)

#### Returns

`boolean`

***

### clear()

> **clear**(): `void`

Defined in: [core/src/collections/SchemaCollection.ts:18](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/collections/SchemaCollection.ts#L18)

#### Returns

`void`
