[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / TagCollection

# Class: TagCollection

Defined in: [core/src/collections/TagCollection.ts:1](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/TagCollection.ts#L1)

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

Defined in: [core/src/collections/TagCollection.ts:6](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/TagCollection.ts#L6)

##### Returns

`number`

## Methods

### get()

> **get**(`key`): `unknown`

Defined in: [core/src/collections/TagCollection.ts:10](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/TagCollection.ts#L10)

#### Parameters

##### key

`Object`

#### Returns

`unknown`

***

### has()

> **has**(`key`): `boolean`

Defined in: [core/src/collections/TagCollection.ts:14](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/TagCollection.ts#L14)

#### Parameters

##### key

`Object`

#### Returns

`boolean`

***

### set()

> **set**(`key`, `tag`): `Map`\<`Object`, `unknown`\>

Defined in: [core/src/collections/TagCollection.ts:18](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/TagCollection.ts#L18)

#### Parameters

##### key

`Object`

##### tag

`unknown`

#### Returns

`Map`\<`Object`, `unknown`\>

***

### delete()

> **delete**(`key`): `boolean`

Defined in: [core/src/collections/TagCollection.ts:23](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/TagCollection.ts#L23)

#### Parameters

##### key

`Object`

#### Returns

`boolean`

***

### setMany()

> **setMany**(`keys`, `tag`): `void`

Defined in: [core/src/collections/TagCollection.ts:33](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/TagCollection.ts#L33)

#### Parameters

##### keys

`Object`[]

##### tag

`unknown`

#### Returns

`void`

***

### combine()

> **combine**(`tags`): `void`

Defined in: [core/src/collections/TagCollection.ts:41](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/TagCollection.ts#L41)

#### Parameters

##### tags

`TagCollection`

#### Returns

`void`

***

### values()

> **values**(): `MapIterator`\<`unknown`\>

Defined in: [core/src/collections/TagCollection.ts:47](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/TagCollection.ts#L47)

#### Returns

`MapIterator`\<`unknown`\>

***

### keys()

> **keys**(): `MapIterator`\<`Object`\>

Defined in: [core/src/collections/TagCollection.ts:51](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/TagCollection.ts#L51)

#### Returns

`MapIterator`\<`Object`\>

***

### \[dispose\]()

> **\[dispose\]**(): `void`

Defined in: [core/src/collections/TagCollection.ts:55](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/TagCollection.ts#L55)

#### Returns

`void`

#### Implementation of

`Disposable.[dispose]`

***

### \[iterator\]()

> **\[iterator\]**(): `MapIterator`\<\[`Object`, `unknown`\]\>

Defined in: [core/src/collections/TagCollection.ts:59](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/TagCollection.ts#L59)

#### Returns

`MapIterator`\<\[`Object`, `unknown`\]\>
