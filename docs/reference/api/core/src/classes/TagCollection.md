[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / TagCollection

# Class: TagCollection

Defined in: [core/src/collections/TagCollection.ts:1](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/collections/TagCollection.ts#L1)

## Implements

- `Disposable`

## Constructors

### Constructor

> **new TagCollection**(): `TagCollection`

#### Returns

`TagCollection`

## Accessors

### size

#### Get Signature

> **get** **size**(): `number`

Defined in: [core/src/collections/TagCollection.ts:8](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/collections/TagCollection.ts#L8)

##### Returns

`number`

## Methods

### get()

> **get**(`key`): `unknown`

Defined in: [core/src/collections/TagCollection.ts:12](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/collections/TagCollection.ts#L12)

#### Parameters

##### key

`object`

#### Returns

`unknown`

***

### has()

> **has**(`key`): `boolean`

Defined in: [core/src/collections/TagCollection.ts:16](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/collections/TagCollection.ts#L16)

#### Parameters

##### key

`object`

#### Returns

`boolean`

***

### set()

> **set**(`key`, `tag`): `Map`\<`object`, `unknown`\>

Defined in: [core/src/collections/TagCollection.ts:20](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/collections/TagCollection.ts#L20)

#### Parameters

##### key

`object`

##### tag

`unknown`

#### Returns

`Map`\<`object`, `unknown`\>

***

### delete()

> **delete**(`key`): `boolean`

Defined in: [core/src/collections/TagCollection.ts:24](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/collections/TagCollection.ts#L24)

#### Parameters

##### key

`object`

#### Returns

`boolean`

***

### setMany()

> **setMany**(`keys`, `tag`): `void`

Defined in: [core/src/collections/TagCollection.ts:28](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/collections/TagCollection.ts#L28)

#### Parameters

##### keys

`object`[]

##### tag

`unknown`

#### Returns

`void`

***

### combine()

> **combine**(`tags`): `void`

Defined in: [core/src/collections/TagCollection.ts:35](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/collections/TagCollection.ts#L35)

#### Parameters

##### tags

`TagCollection`

#### Returns

`void`

***

### values()

> **values**(): `MapIterator`\<`unknown`\>

Defined in: [core/src/collections/TagCollection.ts:41](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/collections/TagCollection.ts#L41)

#### Returns

`MapIterator`\<`unknown`\>

***

### keys()

> **keys**(): `MapIterator`\<`object`\>

Defined in: [core/src/collections/TagCollection.ts:45](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/collections/TagCollection.ts#L45)

#### Returns

`MapIterator`\<`object`\>

***

### \[dispose\]()

> **\[dispose\]**(): `void`

Defined in: [core/src/collections/TagCollection.ts:49](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/collections/TagCollection.ts#L49)

#### Returns

`void`

#### Implementation of

`Disposable.[dispose]`

***

### \[iterator\]()

> **\[iterator\]**(): `MapIterator`\<\[`object`, `unknown`\]\>

Defined in: [core/src/collections/TagCollection.ts:53](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/collections/TagCollection.ts#L53)

#### Returns

`MapIterator`\<\[`object`, `unknown`\]\>
