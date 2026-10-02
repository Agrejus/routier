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

### etagProperty

> **etagProperty**: [`PropertyInfo`](../classes/PropertyInfo.md)\<`TEntity`\> \| `null`

Defined in: [core/src/schema/types.ts:230](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L230)

***

### properties

> **properties**: [`PropertyInfo`](../classes/PropertyInfo.md)\<`TEntity`\>[]

Defined in: [core/src/schema/types.ts:232](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L232)

All property metadata for the schema.

***

### hashType

> **hashType**: [`HashType`](../enumerations/HashType.md)

Defined in: [core/src/schema/types.ts:234](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L234)

The hash type used for this schema.

***

### hash

> **hash**: [`HashFunction`](HashFunction.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:236](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L236)

Computes a hash for the given entity.

***

### getHashType

> **getHashType**: [`GetHashTypeFunction`](GetHashTypeFunction.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:238](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L238)

Returns the hash type for the given entity.

***

### compare()

> **compare**: (`a`, `fromDb`) => `boolean`

Defined in: [core/src/schema/types.ts:240](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L240)

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

Defined in: [core/src/schema/types.ts:242](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L242)

Deserializes an entity from storage format.

#### Parameters

##### entity

[`InferType`](InferType.md)\<`TEntity`\>

#### Returns

[`InferType`](InferType.md)\<`TEntity`\>

***

### set

> **set**: [`SetProperties`](SetProperties.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:244](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L244)

Sets 1 or many properties from the source object onto the destination object with change tracking.

***

### preprocess

> **preprocess**: [`Preprocess`](Preprocess.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:246](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L246)

Combines serializing and preparing an entity for saving.

***

### postprocess

> **postprocess**: [`Enrich`](Enrich.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:248](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L248)

Combines deserializing and enriching an entity for selection.

***

### serialize()

> **serialize**: (`entity`) => [`InferType`](InferType.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:251](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L251)

Serializes an entity to storage format.

#### Parameters

##### entity

[`InferType`](InferType.md)\<`TEntity`\>

#### Returns

[`InferType`](InferType.md)\<`TEntity`\>

***

### id

> **id**: [`SchemaId`](SchemaId.md)

Defined in: [core/src/schema/types.ts:253](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L253)

Unique id for the schema.

***

### collectionName

> **collectionName**: [`CollectionName`](CollectionName.md)

Defined in: [core/src/schema/types.ts:255](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L255)

The name of the collection for this schema.

***

### getIds()

> **getIds**: (`entity`) => \[[`IdType`](IdType.md)\]

Defined in: [core/src/schema/types.ts:257](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L257)

Returns all IDs for the given entity (usually a single-element tuple).

#### Parameters

##### entity

[`InferType`](InferType.md)\<`TEntity`\>

#### Returns

\[[`IdType`](IdType.md)\]

***

### enrich

> **enrich**: [`Enrich`](Enrich.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:259](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L259)

Enriches the entity with change tracking or other metadata.

***

### hasIdentityKeys

> **hasIdentityKeys**: `boolean`

Defined in: [core/src/schema/types.ts:261](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L261)

Indicates if the schema has identity keys.

***

### freeze()

> **freeze**: (`entity`) => [`InferType`](InferType.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:263](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L263)

Returns a deeply frozen (immutable) version of the entity.

#### Parameters

##### entity

[`InferType`](InferType.md)\<`TEntity`\>

#### Returns

[`InferType`](InferType.md)\<`TEntity`\>

***

### enableChangeTracking()

> **enableChangeTracking**: (`entity`) => [`InferType`](InferType.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:265](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L265)

Enables change tracking on the entity.

#### Parameters

##### entity

[`InferType`](InferType.md)\<`TEntity`\>

#### Returns

[`InferType`](InferType.md)\<`TEntity`\>

***

### definition

> **definition**: [`SchemaDefinition`](../classes/SchemaDefinition.md)\<`TEntity`\>

Defined in: [core/src/schema/types.ts:267](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L267)

The schema definition object.

***

### getIndexes()

> **getIndexes**: () => [`Index`](Index.md)[]

Defined in: [core/src/schema/types.ts:269](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L269)

Returns all indexes defined for this schema.

#### Returns

[`Index`](Index.md)[]

***

### compareIds()

> **compareIds**: (`a`, `b`) => `boolean`

Defined in: [core/src/schema/types.ts:271](https://github.com/Agrejus/routier/blob/main/core/src/schema/types.ts#L271)

Compares two entities for Id equality.

#### Parameters

##### a

[`InferType`](InferType.md)\<`TEntity`\>

##### b

[`InferType`](InferType.md)\<`TEntity`\>

#### Returns

`boolean`
