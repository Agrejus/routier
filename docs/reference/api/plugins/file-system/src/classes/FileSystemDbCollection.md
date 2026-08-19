[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/file-system/src](../README.md) / FileSystemDbCollection

# Class: FileSystemDbCollection

Defined in: [plugins/file-system/src/FileSystemDbCollection.ts:10](https://github.com/Agrejus/routier/blob/main/plugins/file-system/src/FileSystemDbCollection.ts#L10)

## Extends

- `MemoryDataCollection`

## Constructors

### Constructor

> **new FileSystemDbCollection**(`path`, `schema`): `FileSystemDbCollection`

Defined in: [plugins/file-system/src/FileSystemDbCollection.ts:19](https://github.com/Agrejus/routier/blob/main/plugins/file-system/src/FileSystemDbCollection.ts#L19)

#### Parameters

##### path

`string`

##### schema

`CompiledSchema`\<`any`\>

#### Returns

`FileSystemDbCollection`

#### Overrides

`MemoryDataCollection.constructor`

## Accessors

### size

#### Get Signature

> **get** **size**(): `number`

Defined in: core/dist/collections/MemoryDataCollection.d.ts:8

##### Returns

`number`

#### Inherited from

`MemoryDataCollection.size`

***

### records

#### Get Signature

> **get** **records**(): `Record`\<`string`, `unknown`\>[]

Defined in: core/dist/collections/MemoryDataCollection.d.ts:9

##### Returns

`Record`\<`string`, `unknown`\>[]

#### Inherited from

`MemoryDataCollection.records`

## Methods

### values()

> **values**(): `IterableIterator`\<`Record`\<`string`, `unknown`\>\>

Defined in: core/dist/collections/MemoryDataCollection.d.ts:11

Iterates stored records without materializing them into an array.

#### Returns

`IterableIterator`\<`Record`\<`string`, `unknown`\>\>

#### Inherited from

`MemoryDataCollection.values`

***

### seed()

> **seed**(`items`): `void`

Defined in: core/dist/collections/MemoryDataCollection.d.ts:16

#### Parameters

##### items

`Record`\<`string`, `unknown`\>[]

#### Returns

`void`

#### Inherited from

`MemoryDataCollection.seed`

***

### add()

> **add**(`item`): `void`

Defined in: core/dist/collections/MemoryDataCollection.d.ts:19

#### Parameters

##### item

`Record`\<`string`, `unknown`\>

#### Returns

`void`

#### Inherited from

`MemoryDataCollection.add`

***

### addIfAbsent()

> **addIfAbsent**(`item`): `void`

Defined in: core/dist/collections/MemoryDataCollection.d.ts:25

Adds a record only when no record with the same key is present. Durable
collections use this to hydrate stored records around in-memory mutations
without clobbering them.

#### Parameters

##### item

`Record`\<`string`, `unknown`\>

#### Returns

`void`

#### Inherited from

`MemoryDataCollection.addIfAbsent`

***

### getByIds()

> **getByIds**(`ids`): `Record`\<`string`, `unknown`\>

Defined in: core/dist/collections/MemoryDataCollection.d.ts:31

Looks up a single record by its key values without scanning the collection.

#### Parameters

##### ids

`IdType`[]

Key values in schema id property order

#### Returns

`Record`\<`string`, `unknown`\>

The matching record or undefined when no record has the given key

#### Inherited from

`MemoryDataCollection.getByIds`

***

### remove()

> **remove**(`item`): `void`

Defined in: core/dist/collections/MemoryDataCollection.d.ts:32

#### Parameters

##### item

`Record`\<`string`, `unknown`\>

#### Returns

`void`

#### Inherited from

`MemoryDataCollection.remove`

***

### update()

> **update**(`item`): `void`

Defined in: core/dist/collections/MemoryDataCollection.d.ts:33

#### Parameters

##### item

`Record`\<`string`, `unknown`\>

#### Returns

`void`

#### Inherited from

`MemoryDataCollection.update`

***

### destroy()

> **destroy**(`done`): `void`

Defined in: [plugins/file-system/src/FileSystemDbCollection.ts:37](https://github.com/Agrejus/routier/blob/main/plugins/file-system/src/FileSystemDbCollection.ts#L37)

#### Parameters

##### done

`CallbackResult`\<`never`\>

#### Returns

`void`

#### Overrides

`MemoryDataCollection.destroy`

***

### load()

> **load**(`done`): `void`

Defined in: [plugins/file-system/src/FileSystemDbCollection.ts:66](https://github.com/Agrejus/routier/blob/main/plugins/file-system/src/FileSystemDbCollection.ts#L66)

#### Parameters

##### done

`CallbackResult`\<`never`\>

#### Returns

`void`

#### Overrides

`MemoryDataCollection.load`

***

### save()

> **save**(`done`): `void`

Defined in: [plugins/file-system/src/FileSystemDbCollection.ts:130](https://github.com/Agrejus/routier/blob/main/plugins/file-system/src/FileSystemDbCollection.ts#L130)

#### Parameters

##### done

`CallbackResult`\<`never`\>

#### Returns

`void`

#### Overrides

`MemoryDataCollection.save`
