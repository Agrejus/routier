[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / SchemaPersistChanges

# Class: SchemaPersistChanges\<T\>

Defined in: [core/src/collections/Changes.ts:150](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/Changes.ts#L150)

## Type Parameters

### T

`T` *extends* `object` = `Record`\<`string`, `unknown`\>

## Constructors

### Constructor

> **new SchemaPersistChanges**\<`T`\>(): `SchemaPersistChanges`\<`T`\>

#### Returns

`SchemaPersistChanges`\<`T`\>

## Properties

### adds

> **adds**: [`InferCreateType`](../type-aliases/InferCreateType.md)\<`T`\>[] = `[]`

Defined in: [core/src/collections/Changes.ts:151](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/Changes.ts#L151)

***

### updates

> **updates**: [`EntityUpdateInfo`](../type-aliases/EntityUpdateInfo.md)\<`T`\>[] = `[]`

Defined in: [core/src/collections/Changes.ts:152](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/Changes.ts#L152)

***

### removes

> **removes**: [`InferType`](../type-aliases/InferType.md)\<`T`\>[] = `[]`

Defined in: [core/src/collections/Changes.ts:153](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/Changes.ts#L153)

***

### tags

> **tags**: [`TagCollection`](TagCollection.md)

Defined in: [core/src/collections/Changes.ts:154](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/Changes.ts#L154)

## Accessors

### hasItems

#### Get Signature

> **get** **hasItems**(): `boolean`

Defined in: [core/src/collections/Changes.ts:156](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/Changes.ts#L156)

##### Returns

`boolean`

***

### total

#### Get Signature

> **get** **total**(): `number`

Defined in: [core/src/collections/Changes.ts:160](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/Changes.ts#L160)

##### Returns

`number`
