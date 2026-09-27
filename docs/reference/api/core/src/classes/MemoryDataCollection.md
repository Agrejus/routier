[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / MemoryDataCollection

# Class: MemoryDataCollection

Defined in: [core/src/collections/MemoryDataCollection.ts:6](https://github.com/Agrejus/routier/blob/main/core/src/collections/MemoryDataCollection.ts#L6)

## Constructors

### Constructor

> **new MemoryDataCollection**(`schema`): `MemoryDataCollection`

Defined in: [core/src/collections/MemoryDataCollection.ts:26](https://github.com/Agrejus/routier/blob/main/core/src/collections/MemoryDataCollection.ts#L26)

#### Parameters

##### schema

[`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`any`\>

#### Returns

`MemoryDataCollection`

## Accessors

### size

#### Get Signature

> **get** **size**(): `number`

Defined in: [core/src/collections/MemoryDataCollection.ts:13](https://github.com/Agrejus/routier/blob/main/core/src/collections/MemoryDataCollection.ts#L13)

##### Returns

`number`

***

### records

#### Get Signature

> **get** **records**(): `Record`\<`string`, `unknown`\>[]

Defined in: [core/src/collections/MemoryDataCollection.ts:17](https://github.com/Agrejus/routier/blob/main/core/src/collections/MemoryDataCollection.ts#L17)

##### Returns

`Record`\<`string`, `unknown`\>[]

## Methods

### values()

> **values**(): `IterableIterator`\<`Record`\<`string`, `unknown`\>\>

Defined in: [core/src/collections/MemoryDataCollection.ts:22](https://github.com/Agrejus/routier/blob/main/core/src/collections/MemoryDataCollection.ts#L22)

Iterates stored records without materializing them into an array.

#### Returns

`IterableIterator`\<`Record`\<`string`, `unknown`\>\>

***

### seed()

> **seed**(`items`): `void`

Defined in: [core/src/collections/MemoryDataCollection.ts:95](https://github.com/Agrejus/routier/blob/main/core/src/collections/MemoryDataCollection.ts#L95)

#### Parameters

##### items

`Record`\<`string`, `unknown`\>[]

#### Returns

`void`

***

### add()

> **add**(`item`): `void`

Defined in: [core/src/collections/MemoryDataCollection.ts:146](https://github.com/Agrejus/routier/blob/main/core/src/collections/MemoryDataCollection.ts#L146)

#### Parameters

##### item

`Record`\<`string`, `unknown`\>

#### Returns

`void`

***

### addIfAbsent()

> **addIfAbsent**(`item`): `void`

Defined in: [core/src/collections/MemoryDataCollection.ts:156](https://github.com/Agrejus/routier/blob/main/core/src/collections/MemoryDataCollection.ts#L156)

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

Defined in: [core/src/collections/MemoryDataCollection.ts:170](https://github.com/Agrejus/routier/blob/main/core/src/collections/MemoryDataCollection.ts#L170)

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

Defined in: [core/src/collections/MemoryDataCollection.ts:174](https://github.com/Agrejus/routier/blob/main/core/src/collections/MemoryDataCollection.ts#L174)

#### Parameters

##### item

`Record`\<`string`, `unknown`\>

#### Returns

`void`

***

### update()

> **update**(`item`): `void`

Defined in: [core/src/collections/MemoryDataCollection.ts:179](https://github.com/Agrejus/routier/blob/main/core/src/collections/MemoryDataCollection.ts#L179)

#### Parameters

##### item

`Record`\<`string`, `unknown`\>

#### Returns

`void`

***

### destroy()

> **destroy**(`done`): `void`

Defined in: [core/src/collections/MemoryDataCollection.ts:184](https://github.com/Agrejus/routier/blob/main/core/src/collections/MemoryDataCollection.ts#L184)

#### Parameters

##### done

[`CallbackResult`](../type-aliases/CallbackResult.md)\<`never`\>

#### Returns

`void`

***

### load()

> **load**(`done`): `void`

Defined in: [core/src/collections/MemoryDataCollection.ts:190](https://github.com/Agrejus/routier/blob/main/core/src/collections/MemoryDataCollection.ts#L190)

#### Parameters

##### done

[`CallbackResult`](../type-aliases/CallbackResult.md)\<`never`\>

#### Returns

`void`

***

### save()

> **save**(`done`): `void`

Defined in: [core/src/collections/MemoryDataCollection.ts:194](https://github.com/Agrejus/routier/blob/main/core/src/collections/MemoryDataCollection.ts#L194)

#### Parameters

##### done

[`CallbackResult`](../type-aliases/CallbackResult.md)\<`never`\>

#### Returns

`void`
