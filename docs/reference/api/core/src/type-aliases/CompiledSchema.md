[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / CompiledSchema

# Type Alias: CompiledSchema\<TEntity\>

> **CompiledSchema**\<`TEntity`\> = `object`

Defined in: [core/src/schema/types.ts:107](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L107)

Represents a fully compiled schema with all utilities and metadata for an entity type.

## Type Parameters

### TEntity

`TEntity` *extends* `object`

## Properties

### deserializePartial()

> **deserializePartial**: (`item`, `properties`) => [`DeepPartial`](DeepPartial.md)\<[`InferType`](InferType.md)\<`TEntity`\>\>

Defined in: [core/src/schema/types.ts:109](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L109)

#### Parameters

##### item

`Record`\<`string`, `unknown`\>

##### properties

[`PropertyInfo`](../classes/PropertyInfo.md)\<`TEntity`\>[]

#### Returns

[`DeepPartial`](DeepPartial.md)\<[`InferType`](InferType.md)\<`TEntity`\>\>

***

### createSubscription()

> **createSubscription**: (`abortSignal?`) => [`ISchemaSubscription`](../interfaces/ISchemaSubscription.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:111](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L111)

#### Parameters

##### abortSignal?

`AbortSignal`

#### Returns

[`ISchemaSubscription`](../interfaces/ISchemaSubscription.md)\<`TEntity`\>

***

### getProperty()

> **getProperty**: (`id`) => [`PropertyInfo`](../classes/PropertyInfo.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:113](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L113)

Returns the property info for a given id (full path)

#### Parameters

##### id

`string`

#### Returns

[`PropertyInfo`](../classes/PropertyInfo.md)\<`TEntity`\>

***

### getId()

> **getId**: (`entity`) => [`IdType`](IdType.md)

Defined in: [core/src/schema/types.ts:115](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L115)

Returns the ID of the given entity.

#### Parameters

##### entity

[`InferType`](InferType.md)\<`TEntity`\>

#### Returns

[`IdType`](IdType.md)

***

### clone()

> **clone**: (`entity`) => [`InferType`](InferType.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:117](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L117)

Returns a deep clone of the given entity.

#### Parameters

##### entity

[`InferType`](InferType.md)\<`TEntity`\>

#### Returns

[`InferType`](InferType.md)\<`TEntity`\>

***

### strip()

> **strip**: (`entity`) => [`InferType`](InferType.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:119](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L119)

Removes unmapped or extraneous properties from the entity.

#### Parameters

##### entity

[`InferType`](InferType.md)\<`TEntity`\>

#### Returns

[`InferType`](InferType.md)\<`TEntity`\>

***

### prepare()

> **prepare**: (`entity`) => [`InferCreateType`](InferCreateType.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:121](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L121)

Prepares a new entity for creation, applying defaults and transformations.

#### Parameters

##### entity

[`InferCreateType`](InferCreateType.md)\<`TEntity`\>

#### Returns

[`InferCreateType`](InferCreateType.md)\<`TEntity`\>

***

### merge()

> **merge**: (`destination`, `source`) => [`InferType`](InferType.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:123](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L123)

Merges the source entity into the destination entity.

#### Parameters

##### destination

[`InferType`](InferType.md)\<`TEntity`\> | [`InferCreateType`](InferCreateType.md)\<`TEntity`\>

##### source

[`InferType`](InferType.md)\<`TEntity`\>

#### Returns

[`InferType`](InferType.md)\<`TEntity`\>

***

### hasIdentities

> **hasIdentities**: `boolean`

Defined in: [core/src/schema/types.ts:125](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L125)

Indicates if the schema has identity properties.

***

### idProperties

> **idProperties**: [`PropertyInfo`](../classes/PropertyInfo.md)\<`TEntity`\>[]

Defined in: [core/src/schema/types.ts:127](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L127)

List of properties that are identity keys.

***

### properties

> **properties**: [`PropertyInfo`](../classes/PropertyInfo.md)\<`TEntity`\>[]

Defined in: [core/src/schema/types.ts:129](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L129)

All property metadata for the schema.

***

### hashType

> **hashType**: [`HashType`](../enumerations/HashType.md)

Defined in: [core/src/schema/types.ts:131](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L131)

The hash type used for this schema.

***

### hash

> **hash**: [`HashFunction`](HashFunction.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:133](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L133)

Computes a hash for the given entity.

***

### getHashType

> **getHashType**: [`GetHashTypeFunction`](GetHashTypeFunction.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:135](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L135)

Returns the hash type for the given entity.

***

### compare()

> **compare**: (`a`, `fromDb`) => `boolean`

Defined in: [core/src/schema/types.ts:137](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L137)

Compares two entities for equality.

#### Parameters

##### a

[`InferType`](InferType.md)\<`TEntity`\>

##### fromDb

[`InferType`](InferType.md)\<`TEntity`\>

#### Returns

`boolean`

***

### deserialize()

> **deserialize**: (`entity`) => [`InferType`](InferType.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:139](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L139)

Deserializes an entity from storage format.

#### Parameters

##### entity

[`InferType`](InferType.md)\<`TEntity`\>

#### Returns

[`InferType`](InferType.md)\<`TEntity`\>

***

### serialize()

> **serialize**: (`entity`) => [`InferType`](InferType.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:141](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L141)

Serializes an entity to storage format.

#### Parameters

##### entity

[`InferType`](InferType.md)\<`TEntity`\>

#### Returns

[`InferType`](InferType.md)\<`TEntity`\>

***

### id

> **id**: [`SchemaId`](SchemaId.md)

Defined in: [core/src/schema/types.ts:143](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L143)

Unique id for the schema.

***

### collectionName

> **collectionName**: `string`

Defined in: [core/src/schema/types.ts:145](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L145)

The name of the collection for this schema.

***

### getIds()

> **getIds**: (`entity`) => \[[`IdType`](IdType.md)\]

Defined in: [core/src/schema/types.ts:147](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L147)

Returns all IDs for the given entity (usually a single-element tuple).

#### Parameters

##### entity

[`InferType`](InferType.md)\<`TEntity`\>

#### Returns

\[[`IdType`](IdType.md)\]

***

### enrich

> **enrich**: `Enrich`\<`TEntity`\>

Defined in: [core/src/schema/types.ts:149](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L149)

Enriches the entity with change tracking or other metadata.

***

### hasIdentityKeys

> **hasIdentityKeys**: `boolean`

Defined in: [core/src/schema/types.ts:151](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L151)

Indicates if the schema has identity keys.

***

### freeze()

> **freeze**: (`entity`) => [`InferType`](InferType.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:153](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L153)

Returns a deeply frozen (immutable) version of the entity.

#### Parameters

##### entity

[`InferType`](InferType.md)\<`TEntity`\>

#### Returns

[`InferType`](InferType.md)\<`TEntity`\>

***

### enableChangeTracking()

> **enableChangeTracking**: (`entity`) => [`InferType`](InferType.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:155](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L155)

Enables change tracking on the entity.

#### Parameters

##### entity

[`InferType`](InferType.md)\<`TEntity`\>

#### Returns

[`InferType`](InferType.md)\<`TEntity`\>

***

### definition

> **definition**: `SchemaDefinition`\<`TEntity`\>

Defined in: [core/src/schema/types.ts:157](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L157)

The schema definition object.

***

### getIndexes()

> **getIndexes**: () => [`Index`](Index.md)[]

Defined in: [core/src/schema/types.ts:159](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L159)

Returns all indexes defined for this schema.

#### Returns

[`Index`](Index.md)[]

***

### compareIds()

> **compareIds**: (`a`, `b`) => `boolean`

Defined in: [core/src/schema/types.ts:161](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L161)

Compares two entities for Id equality.

#### Parameters

##### a

[`InferType`](InferType.md)\<`TEntity`\>

##### b

[`InferType`](InferType.md)\<`TEntity`\>

#### Returns

`boolean`
