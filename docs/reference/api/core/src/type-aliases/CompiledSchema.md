[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / CompiledSchema

# Type Alias: CompiledSchema\<TEntity\>

> **CompiledSchema**\<`TEntity`\> = `object`

Defined in: [core/src/schema/types.ts:200](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L200)

Represents a fully compiled schema with all utilities and metadata for an entity type.

## Type Parameters

### TEntity

`TEntity` *extends* `object`

## Properties

### deserializePartial()

> **deserializePartial**: (`item`, `properties`) => [`DeepPartial`](DeepPartial.md)\<[`InferType`](InferType.md)\<`TEntity`\>\>

Defined in: [core/src/schema/types.ts:202](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L202)

#### Parameters

##### item

`Record`\<`string`, `unknown`\>

##### properties

[`PropertyInfo`](../classes/PropertyInfo.md)\<`TEntity`\>[]

#### Returns

[`DeepPartial`](DeepPartial.md)\<[`InferType`](InferType.md)\<`TEntity`\>\>

***

### createSubscription()

> **createSubscription**: (`abortSignal?`, `scope?`, `options?`) => [`ISchemaSubscription`](../interfaces/ISchemaSubscription.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:204](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L204)

#### Parameters

##### abortSignal?

`AbortSignal`

##### scope?

`string`

##### options?

[`SchemaSubscriptionOptions`](SchemaSubscriptionOptions.md)

#### Returns

[`ISchemaSubscription`](../interfaces/ISchemaSubscription.md)\<`TEntity`\>

***

### getProperty()

> **getProperty**: (`id`) => [`PropertyInfo`](../classes/PropertyInfo.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:206](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L206)

Returns the property info for a given id (full path)

#### Parameters

##### id

`string`

#### Returns

[`PropertyInfo`](../classes/PropertyInfo.md)\<`TEntity`\>

***

### getId()

> **getId**: (`entity`) => [`IdType`](IdType.md)

Defined in: [core/src/schema/types.ts:208](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L208)

Returns the ID of the given entity.

#### Parameters

##### entity

[`InferType`](InferType.md)\<`TEntity`\>

#### Returns

[`IdType`](IdType.md)

***

### clone()

> **clone**: (`entity`) => [`InferType`](InferType.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:210](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L210)

Returns a deep clone of the given entity.

#### Parameters

##### entity

[`InferType`](InferType.md)\<`TEntity`\>

#### Returns

[`InferType`](InferType.md)\<`TEntity`\>

***

### cloneStorage()

> **cloneStorage**: (`entity`) => [`InferType`](InferType.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:219](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L219)

Returns a deep clone of a record that is still in the STORAGE shape — renamed properties
under their `from` names rather than their in-memory names.

`clone` reads in-memory names, so it returns `undefined` for every renamed property of a
stored record. Use this when copying rows a store holds before they have been deserialized.
Generated on first call; schemas that are never cloned in storage shape never build it.

#### Parameters

##### entity

[`InferType`](InferType.md)\<`TEntity`\>

#### Returns

[`InferType`](InferType.md)\<`TEntity`\>

***

### strip()

> **strip**: (`entity`) => [`InferType`](InferType.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:221](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L221)

Removes unmapped or extraneous properties from the entity.

#### Parameters

##### entity

[`InferType`](InferType.md)\<`TEntity`\>

#### Returns

[`InferType`](InferType.md)\<`TEntity`\>

***

### prepare

> **prepare**: [`Prepare`](Prepare.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:223](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L223)

Prepares a new entity for creation, applying defaults and transformations.

***

### merge()

> **merge**: (`destination`, `source`) => [`InferType`](InferType.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:225](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L225)

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

Defined in: [core/src/schema/types.ts:227](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L227)

Indicates if the schema has identity properties.

***

### idProperties

> **idProperties**: [`PropertyInfo`](../classes/PropertyInfo.md)\<`TEntity`\>[]

Defined in: [core/src/schema/types.ts:229](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L229)

List of properties that are identity keys.

***

### properties

> **properties**: [`PropertyInfo`](../classes/PropertyInfo.md)\<`TEntity`\>[]

Defined in: [core/src/schema/types.ts:231](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L231)

All property metadata for the schema.

***

### hashType

> **hashType**: [`HashType`](../enumerations/HashType.md)

Defined in: [core/src/schema/types.ts:233](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L233)

The hash type used for this schema.

***

### hash

> **hash**: [`HashFunction`](HashFunction.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:235](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L235)

Computes a hash for the given entity.

***

### getHashType

> **getHashType**: [`GetHashTypeFunction`](GetHashTypeFunction.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:237](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L237)

Returns the hash type for the given entity.

***

### compare()

> **compare**: (`a`, `fromDb`) => `boolean`

Defined in: [core/src/schema/types.ts:239](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L239)

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

Defined in: [core/src/schema/types.ts:241](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L241)

Deserializes an entity from storage format.

#### Parameters

##### entity

[`InferType`](InferType.md)\<`TEntity`\>

#### Returns

[`InferType`](InferType.md)\<`TEntity`\>

***

### set

> **set**: [`SetProperties`](SetProperties.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:243](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L243)

Sets 1 or many properties from the source object onto the destination object with change tracking.

***

### preprocess

> **preprocess**: [`Preprocess`](Preprocess.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:245](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L245)

Combines serializing and preparing an entity for saving.

***

### postprocess

> **postprocess**: [`Enrich`](Enrich.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:247](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L247)

Combines deserializing and enriching an entity for selection.

***

### serialize()

> **serialize**: (`entity`) => [`InferType`](InferType.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:250](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L250)

Serializes an entity to storage format.

#### Parameters

##### entity

[`InferType`](InferType.md)\<`TEntity`\>

#### Returns

[`InferType`](InferType.md)\<`TEntity`\>

***

### id

> **id**: [`SchemaId`](SchemaId.md)

Defined in: [core/src/schema/types.ts:252](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L252)

Unique id for the schema.

***

### collectionName

> **collectionName**: [`CollectionName`](CollectionName.md)

Defined in: [core/src/schema/types.ts:254](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L254)

The name of the collection for this schema.

***

### getIds()

> **getIds**: (`entity`) => \[[`IdType`](IdType.md)\]

Defined in: [core/src/schema/types.ts:256](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L256)

Returns all IDs for the given entity (usually a single-element tuple).

#### Parameters

##### entity

[`InferType`](InferType.md)\<`TEntity`\>

#### Returns

\[[`IdType`](IdType.md)\]

***

### enrich

> **enrich**: [`Enrich`](Enrich.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:258](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L258)

Enriches the entity with change tracking or other metadata.

***

### hasIdentityKeys

> **hasIdentityKeys**: `boolean`

Defined in: [core/src/schema/types.ts:260](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L260)

Indicates if the schema has identity keys.

***

### freeze()

> **freeze**: (`entity`) => [`InferType`](InferType.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:262](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L262)

Returns a deeply frozen (immutable) version of the entity.

#### Parameters

##### entity

[`InferType`](InferType.md)\<`TEntity`\>

#### Returns

[`InferType`](InferType.md)\<`TEntity`\>

***

### enableChangeTracking()

> **enableChangeTracking**: (`entity`) => [`InferType`](InferType.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:264](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L264)

Enables change tracking on the entity.

#### Parameters

##### entity

[`InferType`](InferType.md)\<`TEntity`\>

#### Returns

[`InferType`](InferType.md)\<`TEntity`\>

***

### definition

> **definition**: [`SchemaDefinition`](../classes/SchemaDefinition.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:266](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L266)

The schema definition object.

***

### getIndexes()

> **getIndexes**: () => [`Index`](Index.md)[]

Defined in: [core/src/schema/types.ts:268](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L268)

Returns all indexes defined for this schema.

#### Returns

[`Index`](Index.md)[]

***

### compareIds()

> **compareIds**: (`a`, `b`) => `boolean`

Defined in: [core/src/schema/types.ts:270](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L270)

Compares two entities for Id equality.

#### Parameters

##### a

[`InferType`](InferType.md)\<`TEntity`\>

##### b

[`InferType`](InferType.md)\<`TEntity`\>

#### Returns

`boolean`
