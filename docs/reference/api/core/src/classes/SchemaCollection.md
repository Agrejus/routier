[**routier-collection**](/reference/api/README)

***

[routier-collection](/reference/api/README) / [core/src](/reference/api/core/src/README) / SchemaCollection

# Class: SchemaCollection

Defined in: [core/src/collections/SchemaCollection.ts:7](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/SchemaCollection.ts#L7)

Collection of schemas with generic typing for type-safe schema retrieval

## Extends

- [`ReadonlySchemaCollection`](/reference/api/core/src/classes/ReadonlySchemaCollection)

## Constructors

### Constructor

> **new SchemaCollection**(`data?`): `SchemaCollection`

Defined in: [core/src/collections/ReadonlySchemaCollection.ts:10](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/ReadonlySchemaCollection.ts#L10)

#### Parameters

##### data?

\[`number`, [`CompiledSchema`](/reference/api/core/src/type-aliases/CompiledSchema)\<`Record`\<`string`, `unknown`\>\>\][]

#### Returns

`SchemaCollection`

#### Inherited from

[`ReadonlySchemaCollection`](/reference/api/core/src/classes/ReadonlySchemaCollection).[`constructor`](/reference/api/core/src/classes/ReadonlySchemaCollection#constructor)

## Accessors

### size

#### Get Signature

> **get** **size**(): `number`

Defined in: [core/src/collections/ReadonlySchemaCollection.ts:22](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/ReadonlySchemaCollection.ts#L22)

##### Returns

`number`

#### Inherited from

[`ReadonlySchemaCollection`](/reference/api/core/src/classes/ReadonlySchemaCollection).[`size`](/reference/api/core/src/classes/ReadonlySchemaCollection#size)

## Methods

### get()

> **get**\<`T`\>(`schemaId`): [`CompiledSchema`](/reference/api/core/src/type-aliases/CompiledSchema)\<`T`\>

Defined in: [core/src/collections/ReadonlySchemaCollection.ts:14](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/ReadonlySchemaCollection.ts#L14)

#### Type Parameters

##### T

`T`

#### Parameters

##### schemaId

`number`

#### Returns

[`CompiledSchema`](/reference/api/core/src/type-aliases/CompiledSchema)\<`T`\>

#### Inherited from

[`ReadonlySchemaCollection`](/reference/api/core/src/classes/ReadonlySchemaCollection).[`get`](/reference/api/core/src/classes/ReadonlySchemaCollection#get)

***

### has()

> **has**(`schemaId`): `boolean`

Defined in: [core/src/collections/ReadonlySchemaCollection.ts:18](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/ReadonlySchemaCollection.ts#L18)

#### Parameters

##### schemaId

`number`

#### Returns

`boolean`

#### Inherited from

[`ReadonlySchemaCollection`](/reference/api/core/src/classes/ReadonlySchemaCollection).[`has`](/reference/api/core/src/classes/ReadonlySchemaCollection#has)

***

### keys()

> **keys**(): `IterableIterator`\<`number`\>

Defined in: [core/src/collections/ReadonlySchemaCollection.ts:26](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/ReadonlySchemaCollection.ts#L26)

#### Returns

`IterableIterator`\<`number`\>

#### Inherited from

[`ReadonlySchemaCollection`](/reference/api/core/src/classes/ReadonlySchemaCollection).[`keys`](/reference/api/core/src/classes/ReadonlySchemaCollection#keys)

***

### values()

> **values**(): `IterableIterator`\<[`CompiledSchema`](/reference/api/core/src/type-aliases/CompiledSchema)\<`Record`\<`string`, `unknown`\>\>\>

Defined in: [core/src/collections/ReadonlySchemaCollection.ts:30](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/ReadonlySchemaCollection.ts#L30)

#### Returns

`IterableIterator`\<[`CompiledSchema`](/reference/api/core/src/type-aliases/CompiledSchema)\<`Record`\<`string`, `unknown`\>\>\>

#### Inherited from

[`ReadonlySchemaCollection`](/reference/api/core/src/classes/ReadonlySchemaCollection).[`values`](/reference/api/core/src/classes/ReadonlySchemaCollection#values)

***

### entries()

> **entries**(): `IterableIterator`\<\[`number`, [`CompiledSchema`](/reference/api/core/src/type-aliases/CompiledSchema)\<`Record`\<`string`, `unknown`\>\>\]\>

Defined in: [core/src/collections/ReadonlySchemaCollection.ts:34](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/ReadonlySchemaCollection.ts#L34)

#### Returns

`IterableIterator`\<\[`number`, [`CompiledSchema`](/reference/api/core/src/type-aliases/CompiledSchema)\<`Record`\<`string`, `unknown`\>\>\]\>

#### Inherited from

[`ReadonlySchemaCollection`](/reference/api/core/src/classes/ReadonlySchemaCollection).[`entries`](/reference/api/core/src/classes/ReadonlySchemaCollection#entries)

***

### forEach()

> **forEach**(`callbackfn`, `thisArg?`): `void`

Defined in: [core/src/collections/ReadonlySchemaCollection.ts:38](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/ReadonlySchemaCollection.ts#L38)

#### Parameters

##### callbackfn

(`value`, `key`, `map`) => `void`

##### thisArg?

`any`

#### Returns

`void`

#### Inherited from

[`ReadonlySchemaCollection`](/reference/api/core/src/classes/ReadonlySchemaCollection).[`forEach`](/reference/api/core/src/classes/ReadonlySchemaCollection#foreach)

***

### \[iterator\]()

> **\[iterator\]**(): `IterableIterator`\<\[`number`, [`CompiledSchema`](/reference/api/core/src/type-aliases/CompiledSchema)\<`Record`\<`string`, `unknown`\>\>\]\>

Defined in: [core/src/collections/ReadonlySchemaCollection.ts:42](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/ReadonlySchemaCollection.ts#L42)

#### Returns

`IterableIterator`\<\[`number`, [`CompiledSchema`](/reference/api/core/src/type-aliases/CompiledSchema)\<`Record`\<`string`, `unknown`\>\>\]\>

#### Inherited from

[`ReadonlySchemaCollection`](/reference/api/core/src/classes/ReadonlySchemaCollection).[`[iterator]`](/reference/api/core/src/classes/ReadonlySchemaCollection#iterator)

***

### getByName()

> **getByName**\<`T`\>(`collectionName`): [`CompiledSchema`](/reference/api/core/src/type-aliases/CompiledSchema)\<`T`\>

Defined in: [core/src/collections/ReadonlySchemaCollection.ts:46](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/ReadonlySchemaCollection.ts#L46)

#### Type Parameters

##### T

`T`

#### Parameters

##### collectionName

`string`

#### Returns

[`CompiledSchema`](/reference/api/core/src/type-aliases/CompiledSchema)\<`T`\>

#### Inherited from

[`ReadonlySchemaCollection`](/reference/api/core/src/classes/ReadonlySchemaCollection).[`getByName`](/reference/api/core/src/classes/ReadonlySchemaCollection#getbyname)

***

### set()

> **set**\<`T`\>(`schemaId`, `schema`): `this`

Defined in: [core/src/collections/SchemaCollection.ts:9](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/SchemaCollection.ts#L9)

#### Type Parameters

##### T

`T`

#### Parameters

##### schemaId

`number`

##### schema

[`CompiledSchema`](/reference/api/core/src/type-aliases/CompiledSchema)\<`T`\>

#### Returns

`this`

***

### delete()

> **delete**(`schemaId`): `boolean`

Defined in: [core/src/collections/SchemaCollection.ts:14](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/SchemaCollection.ts#L14)

#### Parameters

##### schemaId

`number`

#### Returns

`boolean`

***

### clear()

> **clear**(): `void`

Defined in: [core/src/collections/SchemaCollection.ts:18](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/SchemaCollection.ts#L18)

#### Returns

`void`
