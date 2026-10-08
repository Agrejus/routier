[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / SchemaDefinition

# Class: SchemaDefinition\<T\>

Defined in: [core/src/schema/SchemaDefinition.ts:38](https://github.com/Agrejus/routier/blob/main/core/src/schema/SchemaDefinition.ts#L38)

## Extends

- [`SchemaBase`](SchemaBase.md)\<`T`, `any`\>

## Type Parameters

### T

`T` *extends* `object`

## Constructors

### Constructor

> **new SchemaDefinition**\<`T`\>(`collectionName`, `schema`): `SchemaDefinition`\<`T`\>

Defined in: [core/src/schema/SchemaDefinition.ts:44](https://github.com/Agrejus/routier/blob/main/core/src/schema/SchemaDefinition.ts#L44)

#### Parameters

##### collectionName

[`CollectionName`](../type-aliases/CollectionName.md)

##### schema

`T`

#### Returns

`SchemaDefinition`\<`T`\>

#### Overrides

[`SchemaBase`](SchemaBase.md).[`constructor`](SchemaBase.md#constructor)

## Properties

### instance

> **instance**: `T`

Defined in: [core/src/schema/SchemaDefinition.ts:40](https://github.com/Agrejus/routier/blob/main/core/src/schema/SchemaDefinition.ts#L40)

#### Overrides

[`SchemaBase`](SchemaBase.md).[`instance`](SchemaBase.md#instance)

***

### type

> **type**: [`SchemaTypes`](../enumerations/SchemaTypes.md) = `SchemaTypes.Definition`

Defined in: [core/src/schema/SchemaDefinition.ts:41](https://github.com/Agrejus/routier/blob/main/core/src/schema/SchemaDefinition.ts#L41)

#### Overrides

[`SchemaBase`](SchemaBase.md).[`type`](SchemaBase.md#type)

***

### collectionName

> **collectionName**: [`CollectionName`](../type-aliases/CollectionName.md)

Defined in: [core/src/schema/SchemaDefinition.ts:42](https://github.com/Agrejus/routier/blob/main/core/src/schema/SchemaDefinition.ts#L42)

***

### modifiers

> **modifiers**: `any`

Defined in: [core/src/schema/property/base/SchemaBase.ts:6](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L6)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`modifiers`](SchemaBase.md#modifiers)

***

### isNullable

> **isNullable**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:8](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L8)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`isNullable`](SchemaBase.md#isnullable)

***

### isUnmapped

> **isUnmapped**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:9](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L9)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`isUnmapped`](SchemaBase.md#isunmapped)

***

### isOptional

> **isOptional**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:10](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L10)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`isOptional`](SchemaBase.md#isoptional)

***

### isKey

> **isKey**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:11](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L11)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`isKey`](SchemaBase.md#iskey)

***

### isIdentity

> **isIdentity**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:12](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L12)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`isIdentity`](SchemaBase.md#isidentity)

***

### isReadonly

> **isReadonly**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:13](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L13)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`isReadonly`](SchemaBase.md#isreadonly)

***

### isDistinct

> **isDistinct**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:14](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L14)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`isDistinct`](SchemaBase.md#isdistinct)

***

### isEtag

> **isEtag**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:15](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L15)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`isEtag`](SchemaBase.md#isetag)

***

### etagComparator

> **etagComparator**: [`EtagComparator`](../type-aliases/EtagComparator.md)\<[`EtagValue`](../type-aliases/EtagValue.md)\> = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:16](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L16)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`etagComparator`](SchemaBase.md#etagcomparator)

***

### transform

> **transform**: [`PropertyTransform`](../type-aliases/PropertyTransform.md)\<`unknown`\> = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:21](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L21)

Set by `.modify(x => x.transform(...))`. A live reference, never stringified.
`null` when the property is stored as it is.

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`transform`](SchemaBase.md#transform)

***

### indexes

> **indexes**: `string`[] = `[]`

Defined in: [core/src/schema/property/base/SchemaBase.ts:22](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L22)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`indexes`](SchemaBase.md#indexes)

***

### fromPropertyName

> **fromPropertyName**: `string` = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:23](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L23)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`fromPropertyName`](SchemaBase.md#frompropertyname)

***

### dimensions

> **dimensions**: `number` = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:37](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L37)

How many numbers a vector holds. `null` for every other type.

Declared here rather than on `SchemaVector` because a modifier WRAPS rather than
extends: `s.vector(1536).optional()` is a `SchemaOptional`, and anything reachable only
through the original class is lost the moment a modifier is added. `type` survives for
exactly this reason — the copy constructor below carries it — and a dimension count has
to travel with it, or an optional vector reaches a backend as a vector of unknown width
and cannot be given a column.

`innerSchema` is the cautionary example: it lives on `SchemaArray` alone, so a modified
array arrives with no element type and clones through the slow path.

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`dimensions`](SchemaBase.md#dimensions)

***

### maxLength

> **maxLength**: `number` = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:52](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L52)

The longest string the property is declared to hold. `null` for every other type, and
for a string that declares nothing.

Declared here rather than on `SchemaString` for the same reason as `dimensions` above:
`s.string({ maxLength: 4000 }).optional()` is a `SchemaOptional`, so anything reachable
only through `SchemaString` is lost the moment a modifier is added.

A declaration, never a validation. Core does not check a value against it and does not
truncate. The backend that can use the number does: MySQL gives the column
`VARCHAR(maxLength)` instead of the blanket `VARCHAR(255)`. Every other backend ignores
it, because a string column that is already unbounded cannot be made more correct by
knowing a bound.

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`maxLength`](SchemaBase.md#maxlength)

***

### isSearchable

> **isSearchable**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:64](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L64)

Whether this string may be tokenised into a full-text search index.

Set by `.searchable()`, and only ever true on a string. Eligibility, not membership: a
collection that never declares `.searchIndex()` indexes nothing regardless.

Copied by the constructor below, so `s.string().searchable().optional()` stays searchable.
Every flag on this class is copied for the same reason: a modifier WRAPS rather than
extends, so anything the constructor forgets is silently dropped the moment a property
gains one more modifier.

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`isSearchable`](SchemaBase.md#issearchable)

***

### foreignKeyDefinition

> **foreignKeyDefinition**: [`ForeignKey`](../type-aliases/ForeignKey.md)\<`unknown`\> = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:66](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L66)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`foreignKeyDefinition`](SchemaBase.md#foreignkeydefinition)

***

### tags

> **tags**: `string`[] = `[]`

Defined in: [core/src/schema/property/base/SchemaBase.ts:67](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L67)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`tags`](SchemaBase.md#tags)

***

### injected

> **injected**: `any` = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:68](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L68)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`injected`](SchemaBase.md#injected)

***

### defaultValue

> **defaultValue**: [`DefaultValue`](../type-aliases/DefaultValue.md)\<`T`\> = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:69](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L69)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`defaultValue`](SchemaBase.md#defaultvalue)

***

### valueSerializer

> **valueSerializer**: [`PropertySerializer`](../type-aliases/PropertySerializer.md)\<`T`\> = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:70](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L70)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`valueSerializer`](SchemaBase.md#valueserializer)

***

### valueDeserializer

> **valueDeserializer**: [`PropertyDeserializer`](../type-aliases/PropertyDeserializer.md)\<`T`\> = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:71](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L71)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`valueDeserializer`](SchemaBase.md#valuedeserializer)

***

### functionBody

> **functionBody**: [`FunctionBody`](../type-aliases/FunctionBody.md)\<`any`, `T`\>

Defined in: [core/src/schema/property/base/SchemaBase.ts:73](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L73)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`functionBody`](SchemaBase.md#functionbody)

***

### literals

> `readonly` **literals**: `T`[] = `[]`

Defined in: [core/src/schema/property/base/SchemaBase.ts:75](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L75)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`literals`](SchemaBase.md#literals)

## Accessors

### ~standard

#### Get Signature

> **get** **~standard**(): [`Props`](../namespaces/StandardJSONSchemaV1/interfaces/Props.md)\<[`InferCreateType`](../type-aliases/InferCreateType.md)\<`T`\>, [`InferType`](../type-aliases/InferType.md)\<`T`\>\>

Defined in: [core/src/schema/SchemaDefinition.ts:81](https://github.com/Agrejus/routier/blob/main/core/src/schema/SchemaDefinition.ts#L81)

Standard JSON Schema V1 implementation.
Provides JSON Schema conversion for Routier schemas.

##### Returns

[`Props`](../namespaces/StandardJSONSchemaV1/interfaces/Props.md)\<[`InferCreateType`](../type-aliases/InferCreateType.md)\<`T`\>, [`InferType`](../type-aliases/InferType.md)\<`T`\>\>

## Methods

### fromJson()

> `static` **fromJson**(`jsonString`, `collectionName?`): [`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`any`\>

Defined in: [core/src/schema/SchemaDefinition.ts:72](https://github.com/Agrejus/routier/blob/main/core/src/schema/SchemaDefinition.ts#L72)

Creates a SchemaDefinition from a JSON string containing a JSON Schema.
Parses the JSON string, rehydrates the schema structure, and compiles it.

#### Parameters

##### jsonString

`string`

The JSON string containing the JSON Schema (typically from `schema['~standard'].jsonSchema.input()` or `output()`)

##### collectionName?

`string`

Optional collection name override (if not present in JSON Schema metadata)

#### Returns

[`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`any`\>

A compiled schema ready to use

#### Throws

Error if the JSON string is invalid or doesn't contain a valid JSON Schema

#### Example

```typescript
// Serialize a schema to JSON
const jsonSchema = mySchema['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
const jsonString = JSON.stringify(jsonSchema);

// Rehydrate from JSON string
const rehydratedSchema = SchemaDefinition.fromJson(jsonString);
// Schema is already compiled and ready to use
```

***

### modify()

> **modify**\<`R`\>(`builder`): `SchemaDefinition`\<`R` & `T`\>

Defined in: [core/src/schema/SchemaDefinition.ts:123](https://github.com/Agrejus/routier/blob/main/core/src/schema/SchemaDefinition.ts#L123)

#### Type Parameters

##### R

`R`

#### Parameters

##### builder

(`d`) => `R`

#### Returns

`SchemaDefinition`\<`R` & `T`\>

***

### compile()

#### Call Signature

> **compile**\<`TMetadata`\>(`metadata`): [`CompiledSchemaWithMetadata`](../type-aliases/CompiledSchemaWithMetadata.md)\<`T`, `TMetadata`\>

Defined in: [core/src/schema/SchemaDefinition.ts:275](https://github.com/Agrejus/routier/blob/main/core/src/schema/SchemaDefinition.ts#L275)

##### Type Parameters

###### TMetadata

`TMetadata`

##### Parameters

###### metadata

`TMetadata`

##### Returns

[`CompiledSchemaWithMetadata`](../type-aliases/CompiledSchemaWithMetadata.md)\<`T`, `TMetadata`\>

#### Call Signature

> **compile**(): [`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`T`\>

Defined in: [core/src/schema/SchemaDefinition.ts:276](https://github.com/Agrejus/routier/blob/main/core/src/schema/SchemaDefinition.ts#L276)

##### Returns

[`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`T`\>
