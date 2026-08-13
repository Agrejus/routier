[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / SchemaBase

# Abstract Class: SchemaBase\<T, TModifiers\>

Defined in: [core/src/schema/property/base/SchemaBase.ts:3](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L3)

## Extended by

- [`SchemaComputed`](SchemaComputed.md)
- [`SchemaFunction`](SchemaFunction.md)
- [`SchemaTransform`](SchemaTransform.md)
- [`SchemaDefault`](SchemaDefault.md)
- [`SchemaDeserialize`](SchemaDeserialize.md)
- [`SchemaDistinct`](SchemaDistinct.md)
- [`SchemaIdentity`](SchemaIdentity.md)
- [`SchemaIndex`](SchemaIndex.md)
- [`SchemaKey`](SchemaKey.md)
- [`SchemaNullable`](SchemaNullable.md)
- [`SchemaOptional`](SchemaOptional.md)
- [`SchemaReadonly`](SchemaReadonly.md)
- [`SchemaSearchable`](SchemaSearchable.md)
- [`SchemaSerialize`](SchemaSerialize.md)
- [`SchemaTracked`](SchemaTracked.md)
- [`SchemaFrom`](SchemaFrom.md)
- [`SchemaTag`](SchemaTag.md)
- [`SchemaForeignKey`](SchemaForeignKey.md)
- [`SchemaArray`](SchemaArray.md)
- [`SchemaBoolean`](SchemaBoolean.md)
- [`SchemaDate`](SchemaDate.md)
- [`SchemaNumber`](SchemaNumber.md)
- [`SchemaObject`](SchemaObject.md)
- [`SchemaString`](SchemaString.md)
- [`SchemaFile`](SchemaFile.md)
- [`SchemaVector`](SchemaVector.md)
- [`SchemaDefinition`](SchemaDefinition.md)

## Type Parameters

### T

`T` *extends* `any`

### TModifiers

`TModifiers` *extends* [`SchemaModifiers`](../type-aliases/SchemaModifiers.md)

## Constructors

### Constructor

> **new SchemaBase**\<`T`, `TModifiers`\>(`entity?`, `literals?`): `SchemaBase`\<`T`, `TModifiers`\>

Defined in: [core/src/schema/property/base/SchemaBase.ts:75](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L75)

#### Parameters

##### entity?

`SchemaBase`\<`T`, `TModifiers`\>

##### literals?

`T`[]

#### Returns

`SchemaBase`\<`T`, `TModifiers`\>

## Properties

### instance

> `abstract` **instance**: `T`

Defined in: [core/src/schema/property/base/SchemaBase.ts:5](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L5)

***

### modifiers

> **modifiers**: `TModifiers`

Defined in: [core/src/schema/property/base/SchemaBase.ts:6](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L6)

***

### isNullable

> **isNullable**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:8](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L8)

***

### isUnmapped

> **isUnmapped**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:9](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L9)

***

### isOptional

> **isOptional**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:10](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L10)

***

### isKey

> **isKey**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:11](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L11)

***

### isIdentity

> **isIdentity**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:12](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L12)

***

### isReadonly

> **isReadonly**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:13](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L13)

***

### isDistinct

> **isDistinct**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:14](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L14)

***

### transform

> **transform**: [`PropertyTransform`](../type-aliases/PropertyTransform.md)\<`unknown`\> = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:19](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L19)

Set by `.modify(x => x.transform(...))`. A live reference, never stringified.
`null` when the property is stored as it is.

***

### indexes

> **indexes**: `string`[] = `[]`

Defined in: [core/src/schema/property/base/SchemaBase.ts:20](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L20)

***

### fromPropertyName

> **fromPropertyName**: `string` = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:21](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L21)

***

### dimensions

> **dimensions**: `number` = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:35](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L35)

How many numbers a vector holds. `null` for every other type.

Declared here rather than on `SchemaVector` because a modifier WRAPS rather than
extends: `s.vector(1536).optional()` is a `SchemaOptional`, and anything reachable only
through the original class is lost the moment a modifier is added. `type` survives for
exactly this reason — the copy constructor below carries it — and a dimension count has
to travel with it, or an optional vector reaches a backend as a vector of unknown width
and cannot be given a column.

`innerSchema` is the cautionary example: it lives on `SchemaArray` alone, so a modified
array arrives with no element type and clones through the slow path.

***

### maxLength

> **maxLength**: `number` = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:50](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L50)

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

***

### isSearchable

> **isSearchable**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:62](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L62)

Whether this string may be tokenised into a full-text search index.

Set by `.searchable()`, and only ever true on a string. Eligibility, not membership: a
collection that never declares `.searchIndex()` indexes nothing regardless.

Copied by the constructor below, so `s.string().searchable().optional()` stays searchable.
Every flag on this class is copied for the same reason: a modifier WRAPS rather than
extends, so anything the constructor forgets is silently dropped the moment a property
gains one more modifier.

***

### foreignKeyDefinition

> **foreignKeyDefinition**: [`ForeignKey`](../type-aliases/ForeignKey.md)\<`unknown`\> = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:64](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L64)

***

### tags

> **tags**: `string`[] = `[]`

Defined in: [core/src/schema/property/base/SchemaBase.ts:65](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L65)

***

### injected

> **injected**: `any` = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:66](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L66)

***

### defaultValue

> **defaultValue**: [`DefaultValue`](../type-aliases/DefaultValue.md)\<`T`\> = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:67](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L67)

***

### valueSerializer

> **valueSerializer**: [`PropertySerializer`](../type-aliases/PropertySerializer.md)\<`T`\> = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:68](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L68)

***

### valueDeserializer

> **valueDeserializer**: [`PropertyDeserializer`](../type-aliases/PropertyDeserializer.md)\<`T`\> = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:69](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L69)

***

### type

> **type**: [`SchemaTypes`](../enumerations/SchemaTypes.md)

Defined in: [core/src/schema/property/base/SchemaBase.ts:70](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L70)

***

### functionBody

> **functionBody**: [`FunctionBody`](../type-aliases/FunctionBody.md)\<`any`, `T`\>

Defined in: [core/src/schema/property/base/SchemaBase.ts:71](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L71)

***

### literals

> `readonly` **literals**: `T`[] = `[]`

Defined in: [core/src/schema/property/base/SchemaBase.ts:73](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L73)
