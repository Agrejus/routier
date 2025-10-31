[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / BulkPersistChanges

# Class: BulkPersistChanges

Defined in: [core/src/collections/Changes.ts:70](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/Changes.ts#L70)

## Extends

- `Map`\<[`SchemaId`](../type-aliases/SchemaId.md), [`SchemaPersistChanges`](SchemaPersistChanges.md)\>

## Constructors

### Constructor

> **new BulkPersistChanges**(`entries?`): `BulkPersistChanges`

Defined in: node\_modules/typescript/lib/lib.es2015.collection.d.ts:50

#### Parameters

##### entries?

readonly readonly \[`number`, [`SchemaPersistChanges`](SchemaPersistChanges.md)\<`Record`\<`string`, `unknown`\>\>\][]

#### Returns

`BulkPersistChanges`

#### Inherited from

`Map<SchemaId, SchemaPersistChanges>.constructor`

### Constructor

> **new BulkPersistChanges**(`iterable?`): `BulkPersistChanges`

Defined in: node\_modules/typescript/lib/lib.es2015.collection.d.ts:49

#### Parameters

##### iterable?

`Iterable`\<readonly \[`number`, [`SchemaPersistChanges`](SchemaPersistChanges.md)\<`Record`\<`string`, `unknown`\>\>\], `any`, `any`\>

#### Returns

`BulkPersistChanges`

#### Inherited from

`Map<SchemaId, SchemaPersistChanges>.constructor`

## Properties

### size

> `readonly` **size**: `number`

Defined in: node\_modules/typescript/lib/lib.es2015.collection.d.ts:45

#### Returns

the number of elements in the Map.

#### Inherited from

`Map.size`

***

### \[toStringTag\]

> `readonly` **\[toStringTag\]**: `string`

Defined in: node\_modules/typescript/lib/lib.es2015.symbol.wellknown.d.ts:137

#### Inherited from

`Map.[toStringTag]`

***

### \[species\]

> `readonly` `static` **\[species\]**: `MapConstructor`

Defined in: node\_modules/typescript/lib/lib.es2015.symbol.wellknown.d.ts:319

#### Inherited from

`Map.[species]`

## Accessors

### aggregate

#### Get Signature

> **get** **aggregate**(): `object`

Defined in: [core/src/collections/Changes.ts:86](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/Changes.ts#L86)

##### Returns

`object`

###### size

> **size**: `number`

###### adds

> **adds**: `number`

###### updates

> **updates**: `number`

###### removes

> **removes**: `number`

## Methods

### resolve()

> **resolve**(`schemaId`): [`SchemaPersistChanges`](SchemaPersistChanges.md)

Defined in: [core/src/collections/Changes.ts:72](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/Changes.ts#L72)

#### Parameters

##### schemaId

`number`

#### Returns

[`SchemaPersistChanges`](SchemaPersistChanges.md)

***

### get()

> **get**\<`T`\>(`schemaId`): [`SchemaPersistChanges`](SchemaPersistChanges.md)\<`T`\>

Defined in: [core/src/collections/Changes.ts:82](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/Changes.ts#L82)

Returns a specified element from the Map object. If the value that is associated to the provided key is an object, then you will get a reference to that object and any change made to that object will effectively modify it inside the Map.

#### Type Parameters

##### T

`T` *extends* `object` = `Record`\<`string`, `unknown`\>

#### Parameters

##### schemaId

`number`

#### Returns

[`SchemaPersistChanges`](SchemaPersistChanges.md)\<`T`\>

Returns the element associated with the specified key. If no element is associated with the specified key, undefined is returned.

#### Overrides

`Map.get`

***

### toResult()

> **toResult**(): [`BulkPersistResult`](BulkPersistResult.md)

Defined in: [core/src/collections/Changes.ts:139](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/Changes.ts#L139)

Ensures the result has the same result sets as the change sets

#### Returns

[`BulkPersistResult`](BulkPersistResult.md)

***

### clear()

> **clear**(): `void`

Defined in: node\_modules/typescript/lib/lib.es2015.collection.d.ts:20

#### Returns

`void`

#### Inherited from

`Map.clear`

***

### delete()

> **delete**(`key`): `boolean`

Defined in: node\_modules/typescript/lib/lib.es2015.collection.d.ts:24

#### Parameters

##### key

`number`

#### Returns

`boolean`

true if an element in the Map existed and has been removed, or false if the element does not exist.

#### Inherited from

`Map.delete`

***

### forEach()

> **forEach**(`callbackfn`, `thisArg?`): `void`

Defined in: node\_modules/typescript/lib/lib.es2015.collection.d.ts:28

Executes a provided function once per each key/value pair in the Map, in insertion order.

#### Parameters

##### callbackfn

(`value`, `key`, `map`) => `void`

##### thisArg?

`any`

#### Returns

`void`

#### Inherited from

`Map.forEach`

***

### has()

> **has**(`key`): `boolean`

Defined in: node\_modules/typescript/lib/lib.es2015.collection.d.ts:37

#### Parameters

##### key

`number`

#### Returns

`boolean`

boolean indicating whether an element with the specified key exists or not.

#### Inherited from

`Map.has`

***

### set()

> **set**(`key`, `value`): `this`

Defined in: node\_modules/typescript/lib/lib.es2015.collection.d.ts:41

Adds a new element with a specified key and value to the Map. If an element with the same key already exists, the element will be updated.

#### Parameters

##### key

`number`

##### value

[`SchemaPersistChanges`](SchemaPersistChanges.md)

#### Returns

`this`

#### Inherited from

`Map.set`

***

### \[iterator\]()

> **\[iterator\]**(): `MapIterator`\<\[`number`, [`SchemaPersistChanges`](SchemaPersistChanges.md)\<`Record`\<`string`, `unknown`\>\>\]\>

Defined in: node\_modules/typescript/lib/lib.es2015.iterable.d.ts:143

Returns an iterable of entries in the map.

#### Returns

`MapIterator`\<\[`number`, [`SchemaPersistChanges`](SchemaPersistChanges.md)\<`Record`\<`string`, `unknown`\>\>\]\>

#### Inherited from

`Map.[iterator]`

***

### entries()

> **entries**(): `MapIterator`\<\[`number`, [`SchemaPersistChanges`](SchemaPersistChanges.md)\<`Record`\<`string`, `unknown`\>\>\]\>

Defined in: node\_modules/typescript/lib/lib.es2015.iterable.d.ts:148

Returns an iterable of key, value pairs for every entry in the map.

#### Returns

`MapIterator`\<\[`number`, [`SchemaPersistChanges`](SchemaPersistChanges.md)\<`Record`\<`string`, `unknown`\>\>\]\>

#### Inherited from

`Map.entries`

***

### keys()

> **keys**(): `MapIterator`\<`number`\>

Defined in: node\_modules/typescript/lib/lib.es2015.iterable.d.ts:153

Returns an iterable of keys in the map

#### Returns

`MapIterator`\<`number`\>

#### Inherited from

`Map.keys`

***

### values()

> **values**(): `MapIterator`\<[`SchemaPersistChanges`](SchemaPersistChanges.md)\<`Record`\<`string`, `unknown`\>\>\>

Defined in: node\_modules/typescript/lib/lib.es2015.iterable.d.ts:158

Returns an iterable of values in the map

#### Returns

`MapIterator`\<[`SchemaPersistChanges`](SchemaPersistChanges.md)\<`Record`\<`string`, `unknown`\>\>\>

#### Inherited from

`Map.values`
