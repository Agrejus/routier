[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / SchemaTag

# Class: SchemaTag\<T, TModifiers\>

Defined in: [core/src/schema/property/modifiers/SchemaTag.ts:14](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/modifiers/SchemaTag.ts#L14)

## Extends

- [`SchemaBase`](SchemaBase.md)\<`T`, `TModifiers`\>

## Type Parameters

### T

`T` *extends* `any`

### TModifiers

`TModifiers` *extends* [`SchemaModifiers`](../type-aliases/SchemaModifiers.md)

## Constructors

### Constructor

> **new SchemaTag**\<`T`, `TModifiers`\>(`tags`, `current`): `SchemaTag`\<`T`, `TModifiers`\>

Defined in: [core/src/schema/property/modifiers/SchemaTag.ts:18](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/modifiers/SchemaTag.ts#L18)

#### Parameters

##### tags

`string`[]

##### current

[`SchemaBase`](SchemaBase.md)\<`T`, `TModifiers`\>

#### Returns

`SchemaTag`\<`T`, `TModifiers`\>

#### Overrides

[`SchemaBase`](SchemaBase.md).[`constructor`](SchemaBase.md#constructor)

## Properties

### modifiers

> **modifiers**: `TModifiers`

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

### transform

> **transform**: [`PropertyTransform`](../type-aliases/PropertyTransform.md)\<`unknown`\> = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:19](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L19)

Set by `.modify(x => x.transform(...))`. A live reference, never stringified.
`null` when the property is stored as it is.

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`transform`](SchemaBase.md#transform)

***

### indexes

> **indexes**: `string`[] = `[]`

Defined in: [core/src/schema/property/base/SchemaBase.ts:20](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L20)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`indexes`](SchemaBase.md#indexes)

***

### fromPropertyName

> **fromPropertyName**: `string` = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:21](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L21)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`fromPropertyName`](SchemaBase.md#frompropertyname)

***

### dimensions

> **dimensions**: `number` = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:35](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L35)

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

Defined in: [core/src/schema/property/base/SchemaBase.ts:50](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L50)

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

Defined in: [core/src/schema/property/base/SchemaBase.ts:62](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L62)

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

Defined in: [core/src/schema/property/base/SchemaBase.ts:64](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L64)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`foreignKeyDefinition`](SchemaBase.md#foreignkeydefinition)

***

### tags

> **tags**: `string`[] = `[]`

Defined in: [core/src/schema/property/base/SchemaBase.ts:65](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L65)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`tags`](SchemaBase.md#tags)

***

### injected

> **injected**: `any` = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:66](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L66)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`injected`](SchemaBase.md#injected)

***

### defaultValue

> **defaultValue**: [`DefaultValue`](../type-aliases/DefaultValue.md)\<`T`\> = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:67](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L67)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`defaultValue`](SchemaBase.md#defaultvalue)

***

### valueSerializer

> **valueSerializer**: [`PropertySerializer`](../type-aliases/PropertySerializer.md)\<`T`\> = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:68](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L68)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`valueSerializer`](SchemaBase.md#valueserializer)

***

### valueDeserializer

> **valueDeserializer**: [`PropertyDeserializer`](../type-aliases/PropertyDeserializer.md)\<`T`\> = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:69](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L69)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`valueDeserializer`](SchemaBase.md#valuedeserializer)

***

### type

> **type**: [`SchemaTypes`](../enumerations/SchemaTypes.md)

Defined in: [core/src/schema/property/base/SchemaBase.ts:70](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L70)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`type`](SchemaBase.md#type)

***

### functionBody

> **functionBody**: [`FunctionBody`](../type-aliases/FunctionBody.md)\<`any`, `T`\>

Defined in: [core/src/schema/property/base/SchemaBase.ts:71](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L71)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`functionBody`](SchemaBase.md#functionbody)

***

### literals

> `readonly` **literals**: `T`[] = `[]`

Defined in: [core/src/schema/property/base/SchemaBase.ts:73](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/base/SchemaBase.ts#L73)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`literals`](SchemaBase.md#literals)

***

### instance

> **instance**: `T`

Defined in: [core/src/schema/property/modifiers/SchemaTag.ts:15](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/modifiers/SchemaTag.ts#L15)

#### Overrides

[`SchemaBase`](SchemaBase.md).[`instance`](SchemaBase.md#instance)

## Methods

### from()

> **from**(`propertyName`): [`SchemaFrom`](SchemaFrom.md)\<`T`, `TModifiers`\>

Defined in: [core/src/schema/property/modifiers/SchemaTag.ts:24](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/modifiers/SchemaTag.ts#L24)

#### Parameters

##### propertyName

`string`

#### Returns

[`SchemaFrom`](SchemaFrom.md)\<`T`, `TModifiers`\>

***

### optional()

> **optional**(): [`SchemaOptional`](SchemaOptional.md)\<`T`, `"optional"` \| `TModifiers`\>

Defined in: [core/src/schema/property/modifiers/SchemaTag.ts:28](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/modifiers/SchemaTag.ts#L28)

#### Returns

[`SchemaOptional`](SchemaOptional.md)\<`T`, `"optional"` \| `TModifiers`\>

***

### nullable()

> **nullable**(): [`SchemaNullable`](SchemaNullable.md)\<`T`, `"nullable"` \| `TModifiers`\>

Defined in: [core/src/schema/property/modifiers/SchemaTag.ts:32](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/modifiers/SchemaTag.ts#L32)

#### Returns

[`SchemaNullable`](SchemaNullable.md)\<`T`, `"nullable"` \| `TModifiers`\>

***

### default()

> **default**\<`I`\>(`value`, `injected?`): [`SchemaDefault`](SchemaDefault.md)\<`T`, `I`, `"default"` \| `TModifiers`\>

Defined in: [core/src/schema/property/modifiers/SchemaTag.ts:36](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/modifiers/SchemaTag.ts#L36)

#### Type Parameters

##### I

`I` = `never`

#### Parameters

##### value

[`DefaultValue`](../type-aliases/DefaultValue.md)\<`T`, `I`\>

##### injected?

`I`

#### Returns

[`SchemaDefault`](SchemaDefault.md)\<`T`, `I`, `"default"` \| `TModifiers`\>

***

### readonly()

> **readonly**(): [`SchemaReadonly`](SchemaReadonly.md)\<`T`, `"readonly"` \| `TModifiers`\>

Defined in: [core/src/schema/property/modifiers/SchemaTag.ts:40](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/modifiers/SchemaTag.ts#L40)

#### Returns

[`SchemaReadonly`](SchemaReadonly.md)\<`T`, `"readonly"` \| `TModifiers`\>

***

### deserialize()

> **deserialize**(`deserializer`): [`SchemaDeserialize`](SchemaDeserialize.md)\<`T`, `"deserialize"` \| `TModifiers`\>

Defined in: [core/src/schema/property/modifiers/SchemaTag.ts:44](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/modifiers/SchemaTag.ts#L44)

#### Parameters

##### deserializer

[`PropertyDeserializer`](../type-aliases/PropertyDeserializer.md)\<`T`\>

#### Returns

[`SchemaDeserialize`](SchemaDeserialize.md)\<`T`, `"deserialize"` \| `TModifiers`\>

***

### serialize()

> **serialize**(`serializer`): [`SchemaSerialize`](SchemaSerialize.md)\<`T`, `"serialize"` \| `TModifiers`\>

Defined in: [core/src/schema/property/modifiers/SchemaTag.ts:48](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/modifiers/SchemaTag.ts#L48)

#### Parameters

##### serializer

[`PropertySerializer`](../type-aliases/PropertySerializer.md)\<`T`\>

#### Returns

[`SchemaSerialize`](SchemaSerialize.md)\<`T`, `"serialize"` \| `TModifiers`\>

***

### array()

> **array**(): [`SchemaArray`](SchemaArray.md)\<`SchemaTag`\<`T`, `TModifiers`\>, `TModifiers`\>

Defined in: [core/src/schema/property/modifiers/SchemaTag.ts:52](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/modifiers/SchemaTag.ts#L52)

#### Returns

[`SchemaArray`](SchemaArray.md)\<`SchemaTag`\<`T`, `TModifiers`\>, `TModifiers`\>

***

### index()

> **index**(...`indexes`): [`SchemaIndex`](SchemaIndex.md)\<`T`, `TModifiers`\>

Defined in: [core/src/schema/property/modifiers/SchemaTag.ts:56](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/modifiers/SchemaTag.ts#L56)

#### Parameters

##### indexes

...`string`[]

#### Returns

[`SchemaIndex`](SchemaIndex.md)\<`T`, `TModifiers`\>

***

### distinct()

> **distinct**(): [`SchemaDistinct`](SchemaDistinct.md)\<`T`, `"distinct"` \| `TModifiers`\>

Defined in: [core/src/schema/property/modifiers/SchemaTag.ts:60](https://github.com/Agrejus/routier/blob/main/core/src/schema/property/modifiers/SchemaTag.ts#L60)

#### Returns

[`SchemaDistinct`](SchemaDistinct.md)\<`T`, `"distinct"` \| `TModifiers`\>
