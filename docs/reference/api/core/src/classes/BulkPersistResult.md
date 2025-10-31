[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / BulkPersistResult

# Class: BulkPersistResult

Defined in: [core/src/collections/Changes.ts:4](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/Changes.ts#L4)

## Extends

- `Map`\<[`SchemaId`](../type-aliases/SchemaId.md), [`SchemaPersistResult`](SchemaPersistResult.md)\>

## Constructors

### Constructor

> **new BulkPersistResult**(`entries?`): `BulkPersistResult`

Defined in: node\_modules/typescript/lib/lib.es2015.collection.d.ts:50

#### Parameters

##### entries?

readonly readonly \[`number`, [`SchemaPersistResult`](SchemaPersistResult.md)\<`Record`\<`string`, `unknown`\>\>\][]

#### Returns

`BulkPersistResult`

#### Inherited from

`Map<SchemaId, SchemaPersistResult>.constructor`

### Constructor

> **new BulkPersistResult**(`iterable?`): `BulkPersistResult`

Defined in: node\_modules/typescript/lib/lib.es2015.collection.d.ts:49

#### Parameters

##### iterable?

`Iterable`\<readonly \[`number`, [`SchemaPersistResult`](SchemaPersistResult.md)\<`Record`\<`string`, `unknown`\>\>\], `any`, `any`\>

#### Returns

`BulkPersistResult`

#### Inherited from

`Map<SchemaId, SchemaPersistResult>.constructor`

## Properties

### size

> `readonly` **size**: `number`

Defined in: node\_modules/typescript/lib/lib.es2015.collection.d.ts:45

#### Returns

the number of elements in the Map.

#### Inherited from

[`BulkPersistChanges`](BulkPersistChanges.md).[`size`](BulkPersistChanges.md#size)

***

### \[toStringTag\]

> `readonly` **\[toStringTag\]**: `string`

Defined in: node\_modules/typescript/lib/lib.es2015.symbol.wellknown.d.ts:137

#### Inherited from

[`BulkPersistChanges`](BulkPersistChanges.md).[`[toStringTag]`](BulkPersistChanges.md#tostringtag)

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

Defined in: [core/src/collections/Changes.ts:20](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/Changes.ts#L20)

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

> **resolve**(`schemaId`): [`SchemaPersistResult`](SchemaPersistResult.md)

Defined in: [core/src/collections/Changes.ts:6](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/Changes.ts#L6)

#### Parameters

##### schemaId

`number`

#### Returns

[`SchemaPersistResult`](SchemaPersistResult.md)

***

### get()

> **get**\<`T`\>(`schemaId`): [`SchemaPersistResult`](SchemaPersistResult.md)\<`T`\>

Defined in: [core/src/collections/Changes.ts:16](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/Changes.ts#L16)

Returns a specified element from the Map object. If the value that is associated to the provided key is an object, then you will get a reference to that object and any change made to that object will effectively modify it inside the Map.

#### Type Parameters

##### T

`T` *extends* `object` = `Record`\<`string`, `unknown`\>

#### Parameters

##### schemaId

`number`

#### Returns

[`SchemaPersistResult`](SchemaPersistResult.md)\<`T`\>

Returns the element associated with the specified key. If no element is associated with the specified key, undefined is returned.

#### Overrides

`Map.get`

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

[`SchemaPersistResult`](SchemaPersistResult.md)

#### Returns

`this`

#### Inherited from

`Map.set`

***

### \[iterator\]()

> **\[iterator\]**(): `MapIterator`\<\[`number`, [`SchemaPersistResult`](SchemaPersistResult.md)\<`Record`\<`string`, `unknown`\>\>\]\>

Defined in: node\_modules/typescript/lib/lib.es2015.iterable.d.ts:143

Returns an iterable of entries in the map.

#### Returns

`MapIterator`\<\[`number`, [`SchemaPersistResult`](SchemaPersistResult.md)\<`Record`\<`string`, `unknown`\>\>\]\>

#### Inherited from

`Map.[iterator]`

***

### entries()

> **entries**(): `MapIterator`\<\[`number`, [`SchemaPersistResult`](SchemaPersistResult.md)\<`Record`\<`string`, `unknown`\>\>\]\>

Defined in: node\_modules/typescript/lib/lib.es2015.iterable.d.ts:148

Returns an iterable of key, value pairs for every entry in the map.

#### Returns

`MapIterator`\<\[`number`, [`SchemaPersistResult`](SchemaPersistResult.md)\<`Record`\<`string`, `unknown`\>\>\]\>

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

> **values**(): `MapIterator`\<[`SchemaPersistResult`](SchemaPersistResult.md)\<`Record`\<`string`, `unknown`\>\>\>

Defined in: node\_modules/typescript/lib/lib.es2015.iterable.d.ts:158

Returns an iterable of values in the map

#### Returns

`MapIterator`\<[`SchemaPersistResult`](SchemaPersistResult.md)\<`Record`\<`string`, `unknown`\>\>\>

#### Inherited from

`Map.values`
