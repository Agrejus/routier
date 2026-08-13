[**routier-collection**](/reference/api/README)

***

[routier-collection](/reference/api/README) / [core/src](/reference/api/core/src/README) / SchemaPersistChanges

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

> **adds**: [`InferCreateType`](/reference/api/core/src/type-aliases/InferCreateType)\<`T`\>[] = `[]`

Defined in: [core/src/collections/Changes.ts:151](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/Changes.ts#L151)

***

### updates

> **updates**: [`EntityUpdateInfo`](/reference/api/core/src/type-aliases/EntityUpdateInfo)\<`T`\>[] = `[]`

Defined in: [core/src/collections/Changes.ts:152](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/Changes.ts#L152)

***

### removes

> **removes**: [`InferType`](/reference/api/core/src/type-aliases/InferType)\<`T`\>[] = `[]`

Defined in: [core/src/collections/Changes.ts:153](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/collections/Changes.ts#L153)

***

### tags

> **tags**: [`TagCollection`](/reference/api/core/src/classes/TagCollection)

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
