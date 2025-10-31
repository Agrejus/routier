[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / MemoryDataCollection

# Class: MemoryDataCollection

Defined in: [core/src/collections/MemoryDataCollection.ts:6](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/MemoryDataCollection.ts#L6)

## Constructors

### Constructor

> **new MemoryDataCollection**(`schema`): `MemoryDataCollection`

Defined in: [core/src/collections/MemoryDataCollection.ts:21](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/MemoryDataCollection.ts#L21)

#### Parameters

##### schema

[`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`any`\>

#### Returns

`MemoryDataCollection`

## Accessors

### size

#### Get Signature

> **get** **size**(): `number`

Defined in: [core/src/collections/MemoryDataCollection.ts:13](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/MemoryDataCollection.ts#L13)

##### Returns

`number`

***

### records

#### Get Signature

> **get** **records**(): `Record`\<`string`, `unknown`\>[]

Defined in: [core/src/collections/MemoryDataCollection.ts:17](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/MemoryDataCollection.ts#L17)

##### Returns

`Record`\<`string`, `unknown`\>[]

## Methods

### seed()

> **seed**(`items`): `void`

Defined in: [core/src/collections/MemoryDataCollection.ts:61](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/MemoryDataCollection.ts#L61)

#### Parameters

##### items

`Record`\<`string`, `unknown`\>[]

#### Returns

`void`

***

### add()

> **add**(`item`): `void`

Defined in: [core/src/collections/MemoryDataCollection.ts:106](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/MemoryDataCollection.ts#L106)

#### Parameters

##### item

`Record`\<`string`, `unknown`\>

#### Returns

`void`

***

### remove()

> **remove**(`item`): `void`

Defined in: [core/src/collections/MemoryDataCollection.ts:111](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/MemoryDataCollection.ts#L111)

#### Parameters

##### item

`Record`\<`string`, `unknown`\>

#### Returns

`void`

***

### update()

> **update**(`item`): `void`

Defined in: [core/src/collections/MemoryDataCollection.ts:116](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/MemoryDataCollection.ts#L116)

#### Parameters

##### item

`Record`\<`string`, `unknown`\>

#### Returns

`void`

***

### destroy()

> **destroy**(`done`): `void`

Defined in: [core/src/collections/MemoryDataCollection.ts:121](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/MemoryDataCollection.ts#L121)

#### Parameters

##### done

[`CallbackResult`](../type-aliases/CallbackResult.md)\<`never`\>

#### Returns

`void`

***

### load()

> **load**(`done`): `void`

Defined in: [core/src/collections/MemoryDataCollection.ts:127](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/MemoryDataCollection.ts#L127)

#### Parameters

##### done

[`CallbackResult`](../type-aliases/CallbackResult.md)\<`never`\>

#### Returns

`void`

***

### save()

> **save**(`done`): `void`

Defined in: [core/src/collections/MemoryDataCollection.ts:131](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/MemoryDataCollection.ts#L131)

#### Parameters

##### done

[`CallbackResult`](../type-aliases/CallbackResult.md)\<`never`\>

#### Returns

`void`
