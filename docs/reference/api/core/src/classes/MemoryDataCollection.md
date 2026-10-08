[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / MemoryDataCollection

# Class: MemoryDataCollection

Defined in: [core/src/collections/MemoryDataCollection.ts:5](https://github.com/Agrejus/routier/blob/main/core/src/collections/MemoryDataCollection.ts#L5)

## Constructors

### Constructor

> **new MemoryDataCollection**(`schema`): `MemoryDataCollection`

Defined in: [core/src/collections/MemoryDataCollection.ts:25](https://github.com/Agrejus/routier/blob/main/core/src/collections/MemoryDataCollection.ts#L25)

#### Parameters

##### schema

[`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`any`\>

#### Returns

`MemoryDataCollection`

## Accessors

### size

#### Get Signature

> **get** **size**(): `number`

Defined in: [core/src/collections/MemoryDataCollection.ts:12](https://github.com/Agrejus/routier/blob/main/core/src/collections/MemoryDataCollection.ts#L12)

##### Returns

`number`

***

### records

#### Get Signature

> **get** **records**(): `Record`\<`string`, `unknown`\>[]

Defined in: [core/src/collections/MemoryDataCollection.ts:16](https://github.com/Agrejus/routier/blob/main/core/src/collections/MemoryDataCollection.ts#L16)

##### Returns

`Record`\<`string`, `unknown`\>[]

## Methods

### values()

> **values**(): `IterableIterator`\<`Record`\<`string`, `unknown`\>\>

Defined in: [core/src/collections/MemoryDataCollection.ts:21](https://github.com/Agrejus/routier/blob/main/core/src/collections/MemoryDataCollection.ts#L21)

Iterates stored records without materializing them into an array.

#### Returns

`IterableIterator`\<`Record`\<`string`, `unknown`\>\>

***

### seed()

> **seed**(`items`): `void`

Defined in: [core/src/collections/MemoryDataCollection.ts:94](https://github.com/Agrejus/routier/blob/main/core/src/collections/MemoryDataCollection.ts#L94)

#### Parameters

##### items

`Record`\<`string`, `unknown`\>[]

#### Returns

`void`

***

### add()

> **add**(`item`): `void`

Defined in: [core/src/collections/MemoryDataCollection.ts:152](https://github.com/Agrejus/routier/blob/main/core/src/collections/MemoryDataCollection.ts#L152)

#### Parameters

##### item

`Record`\<`string`, `unknown`\>

#### Returns

`void`

***

### addIfAbsent()

> **addIfAbsent**(`item`): `void`

Defined in: [core/src/collections/MemoryDataCollection.ts:161](https://github.com/Agrejus/routier/blob/main/core/src/collections/MemoryDataCollection.ts#L161)

Adds a record only when no record with the same key is present. Durable
collections use this to hydrate stored records around in-memory mutations
without clobbering them.

#### Parameters

##### item

`Record`\<`string`, `unknown`\>

#### Returns

`void`

***

### getByIds()

> **getByIds**(`ids`): `Record`\<`string`, `unknown`\>

Defined in: [core/src/collections/MemoryDataCollection.ts:174](https://github.com/Agrejus/routier/blob/main/core/src/collections/MemoryDataCollection.ts#L174)

Looks up a single record by its key values without scanning the collection.

#### Parameters

##### ids

[`IdType`](../type-aliases/IdType.md)[]

Key values in schema id property order

#### Returns

`Record`\<`string`, `unknown`\>

The matching record or undefined when no record has the given key

***

### remove()

> **remove**(`item`): `void`

Defined in: [core/src/collections/MemoryDataCollection.ts:178](https://github.com/Agrejus/routier/blob/main/core/src/collections/MemoryDataCollection.ts#L178)

#### Parameters

##### item

`Record`\<`string`, `unknown`\>

#### Returns

`void`

***

### update()

> **update**(`item`): `void`

Defined in: [core/src/collections/MemoryDataCollection.ts:182](https://github.com/Agrejus/routier/blob/main/core/src/collections/MemoryDataCollection.ts#L182)

#### Parameters

##### item

`Record`\<`string`, `unknown`\>

#### Returns

`void`

***

### destroy()

> **destroy**(`done`): `void`

Defined in: [core/src/collections/MemoryDataCollection.ts:186](https://github.com/Agrejus/routier/blob/main/core/src/collections/MemoryDataCollection.ts#L186)

#### Parameters

##### done

[`CallbackResult`](../type-aliases/CallbackResult.md)\<`never`\>

#### Returns

`void`

***

### load()

> **load**(`done`): `void`

Defined in: [core/src/collections/MemoryDataCollection.ts:192](https://github.com/Agrejus/routier/blob/main/core/src/collections/MemoryDataCollection.ts#L192)

#### Parameters

##### done

[`CallbackResult`](../type-aliases/CallbackResult.md)\<`never`\>

#### Returns

`void`

***

### save()

> **save**(`done`): `void`

Defined in: [core/src/collections/MemoryDataCollection.ts:196](https://github.com/Agrejus/routier/blob/main/core/src/collections/MemoryDataCollection.ts#L196)

#### Parameters

##### done

[`CallbackResult`](../type-aliases/CallbackResult.md)\<`never`\>

#### Returns

`void`
