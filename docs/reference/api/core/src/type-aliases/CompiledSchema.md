[**routier-collection**](/reference/api/README)

***

[routier-collection](/reference/api/README) / [core/src](/reference/api/core/src/README) / CompiledSchema

# Type Alias: CompiledSchema\<TEntity\>

> **CompiledSchema**\<`TEntity`\> = `object`

Defined in: [core/src/schema/types.ts:107](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L107)

Represents a fully compiled schema with all utilities and metadata for an entity type.

## Type Parameters

### TEntity

`TEntity` *extends* `object`

## Properties

### deserializePartial()

> **deserializePartial**: (`item`, `properties`) => [`DeepPartial`](/reference/api/core/src/type-aliases/DeepPartial)\<[`InferType`](/reference/api/core/src/type-aliases/InferType)\<`TEntity`\>\>

Defined in: [core/src/schema/types.ts:109](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L109)

#### Parameters

##### item

`Record`\<`string`, `unknown`\>

##### properties

[`PropertyInfo`](/reference/api/core/src/classes/PropertyInfo)\<`TEntity`\>[]

#### Returns

[`DeepPartial`](/reference/api/core/src/type-aliases/DeepPartial)\<[`InferType`](/reference/api/core/src/type-aliases/InferType)\<`TEntity`\>\>

***

### createSubscription()

> **createSubscription**: (`abortSignal?`) => [`ISchemaSubscription`](/reference/api/core/src/interfaces/ISchemaSubscription)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:111](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L111)

#### Parameters

##### abortSignal?

`AbortSignal`

#### Returns

[`ISchemaSubscription`](/reference/api/core/src/interfaces/ISchemaSubscription)\<`TEntity`\>

***

### getProperty()

> **getProperty**: (`id`) => [`PropertyInfo`](/reference/api/core/src/classes/PropertyInfo)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:113](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L113)

Returns the property info for a given id (full path)

#### Parameters

##### id

`string`

#### Returns

[`PropertyInfo`](/reference/api/core/src/classes/PropertyInfo)\<`TEntity`\>

***

### getId()

> **getId**: (`entity`) => [`IdType`](/reference/api/core/src/type-aliases/IdType)

Defined in: [core/src/schema/types.ts:115](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L115)

Returns the ID of the given entity.

#### Parameters

##### entity

[`InferType`](/reference/api/core/src/type-aliases/InferType)\<`TEntity`\>

#### Returns

[`IdType`](/reference/api/core/src/type-aliases/IdType)

***

### clone()

> **clone**: (`entity`) => [`InferType`](/reference/api/core/src/type-aliases/InferType)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:117](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L117)

Returns a deep clone of the given entity.

#### Parameters

##### entity

[`InferType`](/reference/api/core/src/type-aliases/InferType)\<`TEntity`\>

#### Returns

[`InferType`](/reference/api/core/src/type-aliases/InferType)\<`TEntity`\>

***

### strip()

> **strip**: (`entity`) => [`InferType`](/reference/api/core/src/type-aliases/InferType)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:119](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L119)

Removes unmapped or extraneous properties from the entity.

#### Parameters

##### entity

[`InferType`](/reference/api/core/src/type-aliases/InferType)\<`TEntity`\>

#### Returns

[`InferType`](/reference/api/core/src/type-aliases/InferType)\<`TEntity`\>

***

### prepare()

> **prepare**: (`entity`) => [`InferCreateType`](/reference/api/core/src/type-aliases/InferCreateType)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:121](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L121)

Prepares a new entity for creation, applying defaults and transformations.

#### Parameters

##### entity

[`InferCreateType`](/reference/api/core/src/type-aliases/InferCreateType)\<`TEntity`\>

#### Returns

[`InferCreateType`](/reference/api/core/src/type-aliases/InferCreateType)\<`TEntity`\>

***

### merge()

> **merge**: (`destination`, `source`) => [`InferType`](/reference/api/core/src/type-aliases/InferType)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:123](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L123)

Merges the source entity into the destination entity.

#### Parameters

##### destination

[`InferType`](/reference/api/core/src/type-aliases/InferType)\<`TEntity`\> | [`InferCreateType`](/reference/api/core/src/type-aliases/InferCreateType)\<`TEntity`\>

##### source

[`InferType`](/reference/api/core/src/type-aliases/InferType)\<`TEntity`\>

#### Returns

[`InferType`](/reference/api/core/src/type-aliases/InferType)\<`TEntity`\>

***

### hasIdentities

> **hasIdentities**: `boolean`

Defined in: [core/src/schema/types.ts:125](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L125)

Indicates if the schema has identity properties.

***

### idProperties

> **idProperties**: [`PropertyInfo`](/reference/api/core/src/classes/PropertyInfo)\<`TEntity`\>[]

Defined in: [core/src/schema/types.ts:127](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L127)

List of properties that are identity keys.

***

### properties

> **properties**: [`PropertyInfo`](/reference/api/core/src/classes/PropertyInfo)\<`TEntity`\>[]

Defined in: [core/src/schema/types.ts:129](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L129)

All property metadata for the schema.

***

### hashType

> **hashType**: [`HashType`](/reference/api/core/src/enumerations/HashType)

Defined in: [core/src/schema/types.ts:131](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L131)

The hash type used for this schema.

***

### hash

> **hash**: [`HashFunction`](/reference/api/core/src/type-aliases/HashFunction)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:133](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L133)

Computes a hash for the given entity.

***

### getHashType

> **getHashType**: [`GetHashTypeFunction`](/reference/api/core/src/type-aliases/GetHashTypeFunction)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:135](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L135)

Returns the hash type for the given entity.

***

### compare()

> **compare**: (`a`, `fromDb`) => `boolean`

Defined in: [core/src/schema/types.ts:137](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L137)

Compares two entities for equality.

#### Parameters

##### a

[`InferType`](/reference/api/core/src/type-aliases/InferType)\<`TEntity`\>

##### fromDb

[`InferType`](/reference/api/core/src/type-aliases/InferType)\<`TEntity`\>

#### Returns

`boolean`

***

### deserialize()

> **deserialize**: (`entity`) => [`InferType`](/reference/api/core/src/type-aliases/InferType)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:139](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L139)

Deserializes an entity from storage format.

#### Parameters

##### entity

[`InferType`](/reference/api/core/src/type-aliases/InferType)\<`TEntity`\>

#### Returns

[`InferType`](/reference/api/core/src/type-aliases/InferType)\<`TEntity`\>

***

### serialize()

> **serialize**: (`entity`) => [`InferType`](/reference/api/core/src/type-aliases/InferType)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:141](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L141)

Serializes an entity to storage format.

#### Parameters

##### entity

[`InferType`](/reference/api/core/src/type-aliases/InferType)\<`TEntity`\>

#### Returns

[`InferType`](/reference/api/core/src/type-aliases/InferType)\<`TEntity`\>

***

### id

> **id**: [`SchemaId`](/reference/api/core/src/type-aliases/SchemaId)

Defined in: [core/src/schema/types.ts:143](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L143)

Unique id for the schema.

***

### collectionName

> **collectionName**: `string`

Defined in: [core/src/schema/types.ts:145](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L145)

The name of the collection for this schema.

***

### getIds()

> **getIds**: (`entity`) => \[[`IdType`](/reference/api/core/src/type-aliases/IdType)\]

Defined in: [core/src/schema/types.ts:147](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L147)

Returns all IDs for the given entity (usually a single-element tuple).

#### Parameters

##### entity

[`InferType`](/reference/api/core/src/type-aliases/InferType)\<`TEntity`\>

#### Returns

\[[`IdType`](/reference/api/core/src/type-aliases/IdType)\]

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

> **freeze**: (`entity`) => [`InferType`](/reference/api/core/src/type-aliases/InferType)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:153](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L153)

Returns a deeply frozen (immutable) version of the entity.

#### Parameters

##### entity

[`InferType`](/reference/api/core/src/type-aliases/InferType)\<`TEntity`\>

#### Returns

[`InferType`](/reference/api/core/src/type-aliases/InferType)\<`TEntity`\>

***

### enableChangeTracking()

> **enableChangeTracking**: (`entity`) => [`InferType`](/reference/api/core/src/type-aliases/InferType)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:155](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L155)

Enables change tracking on the entity.

#### Parameters

##### entity

[`InferType`](/reference/api/core/src/type-aliases/InferType)\<`TEntity`\>

#### Returns

[`InferType`](/reference/api/core/src/type-aliases/InferType)\<`TEntity`\>

***

### definition

> **definition**: `SchemaDefinition`\<`TEntity`\>

Defined in: [core/src/schema/types.ts:157](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L157)

The schema definition object.

***

### getIndexes()

> **getIndexes**: () => [`Index`](/reference/api/core/src/type-aliases/Index)[]

Defined in: [core/src/schema/types.ts:159](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L159)

Returns all indexes defined for this schema.

#### Returns

[`Index`](/reference/api/core/src/type-aliases/Index)[]

***

### compareIds()

> **compareIds**: (`a`, `b`) => `boolean`

Defined in: [core/src/schema/types.ts:161](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/types.ts#L161)

Compares two entities for Id equality.

#### Parameters

##### a

[`InferType`](/reference/api/core/src/type-aliases/InferType)\<`TEntity`\>

##### b

[`InferType`](/reference/api/core/src/type-aliases/InferType)\<`TEntity`\>

#### Returns

`boolean`
