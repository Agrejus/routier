[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / SchemaString

# Class: SchemaString\<T, TModifiers\>

Defined in: [core/src/schema/property/types/SchemaString.ts:19](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/types/SchemaString.ts#L19)

## Extends

- [`SchemaBase`](SchemaBase.md)\<`T`, `TModifiers`\>

## Type Parameters

### T

`T` *extends* `string`

### TModifiers

`TModifiers` *extends* [`SchemaModifiers`](../type-aliases/SchemaModifiers.md)

## Constructors

### Constructor

> **new SchemaString**\<`T`, `TModifiers`\>(`entity?`, `literals?`, `options?`): `SchemaString`\<`T`, `TModifiers`\>

Defined in: [core/src/schema/property/types/SchemaString.ts:30](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/types/SchemaString.ts#L30)

#### Parameters

##### entity?

[`SchemaBase`](SchemaBase.md)\<`T`, `TModifiers`\>

Copied from when a modifier wraps this property.

##### literals?

`T`[]

The allowed values, when the string is a literal union.

##### options?

[`StringOptions`](../type-aliases/StringOptions.md)

Declarations a backend may use. See `StringOptions`.

#### Returns

`SchemaString`\<`T`, `TModifiers`\>

#### Overrides

[`SchemaBase`](SchemaBase.md).[`constructor`](SchemaBase.md#constructor)

## Properties

### modifiers

> **modifiers**: `TModifiers`

Defined in: [core/src/schema/property/base/SchemaBase.ts:6](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L6)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`modifiers`](SchemaBase.md#modifiers)

***

### isNullable

> **isNullable**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:8](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L8)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`isNullable`](SchemaBase.md#isnullable)

***

### isUnmapped

> **isUnmapped**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:9](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L9)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`isUnmapped`](SchemaBase.md#isunmapped)

***

### isOptional

> **isOptional**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:10](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L10)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`isOptional`](SchemaBase.md#isoptional)

***

### isKey

> **isKey**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:11](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L11)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`isKey`](SchemaBase.md#iskey)

***

### isIdentity

> **isIdentity**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:12](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L12)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`isIdentity`](SchemaBase.md#isidentity)

***

### isReadonly

> **isReadonly**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:13](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L13)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`isReadonly`](SchemaBase.md#isreadonly)

***

### isDistinct

> **isDistinct**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:14](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L14)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`isDistinct`](SchemaBase.md#isdistinct)

***

### transform

> **transform**: [`PropertyTransform`](../type-aliases/PropertyTransform.md)\<`unknown`\> = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:19](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L19)

Set by `.modify(x => x.transform(...))`. A live reference, never stringified.
`null` when the property is stored as it is.

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`transform`](SchemaBase.md#transform)

***

### indexes

> **indexes**: `string`[] = `[]`

Defined in: [core/src/schema/property/base/SchemaBase.ts:20](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L20)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`indexes`](SchemaBase.md#indexes)

***

### fromPropertyName

> **fromPropertyName**: `string` = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:21](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L21)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`fromPropertyName`](SchemaBase.md#frompropertyname)

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

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`dimensions`](SchemaBase.md#dimensions)

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

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`maxLength`](SchemaBase.md#maxlength)

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

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`isSearchable`](SchemaBase.md#issearchable)

***

### foreignKeyDefinition

> **foreignKeyDefinition**: [`ForeignKey`](../type-aliases/ForeignKey.md)\<`unknown`\> = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:64](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L64)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`foreignKeyDefinition`](SchemaBase.md#foreignkeydefinition)

***

### tags

> **tags**: `string`[] = `[]`

Defined in: [core/src/schema/property/base/SchemaBase.ts:65](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L65)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`tags`](SchemaBase.md#tags)

***

### injected

> **injected**: `any` = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:66](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L66)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`injected`](SchemaBase.md#injected)

***

### defaultValue

> **defaultValue**: [`DefaultValue`](../type-aliases/DefaultValue.md)\<`T`\> = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:67](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L67)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`defaultValue`](SchemaBase.md#defaultvalue)

***

### valueSerializer

> **valueSerializer**: [`PropertySerializer`](../type-aliases/PropertySerializer.md)\<`T`\> = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:68](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L68)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`valueSerializer`](SchemaBase.md#valueserializer)

***

### valueDeserializer

> **valueDeserializer**: [`PropertyDeserializer`](../type-aliases/PropertyDeserializer.md)\<`T`\> = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:69](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L69)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`valueDeserializer`](SchemaBase.md#valuedeserializer)

***

### functionBody

> **functionBody**: [`FunctionBody`](../type-aliases/FunctionBody.md)\<`any`, `T`\>

Defined in: [core/src/schema/property/base/SchemaBase.ts:71](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L71)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`functionBody`](SchemaBase.md#functionbody)

***

### literals

> `readonly` **literals**: `T`[] = `[]`

Defined in: [core/src/schema/property/base/SchemaBase.ts:73](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/base/SchemaBase.ts#L73)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`literals`](SchemaBase.md#literals)

***

### instance

> **instance**: `T`

Defined in: [core/src/schema/property/types/SchemaString.ts:21](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/types/SchemaString.ts#L21)

#### Overrides

[`SchemaBase`](SchemaBase.md).[`instance`](SchemaBase.md#instance)

***

### type

> **type**: [`SchemaTypes`](../enumerations/SchemaTypes.md) = `SchemaTypes.String`

Defined in: [core/src/schema/property/types/SchemaString.ts:22](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/types/SchemaString.ts#L22)

#### Overrides

[`SchemaBase`](SchemaBase.md).[`type`](SchemaBase.md#type)

## Methods

### from()

> **from**(`propertyName`): [`SchemaFrom`](SchemaFrom.md)\<`T`, `TModifiers`\>

Defined in: [core/src/schema/property/types/SchemaString.ts:46](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/types/SchemaString.ts#L46)

#### Parameters

##### propertyName

`string`

#### Returns

[`SchemaFrom`](SchemaFrom.md)\<`T`, `TModifiers`\>

***

### constrain()

> **constrain**\<`K`\>(): `SchemaString`\<`K`, `TModifiers`\>

Defined in: [core/src/schema/property/types/SchemaString.ts:50](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/types/SchemaString.ts#L50)

#### Type Parameters

##### K

`K` *extends* `string`

#### Returns

`SchemaString`\<`K`, `TModifiers`\>

***

### optional()

> **optional**(): [`SchemaOptional`](SchemaOptional.md)\<`T`, `"optional"` \| `TModifiers`\>

Defined in: [core/src/schema/property/types/SchemaString.ts:54](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/types/SchemaString.ts#L54)

#### Returns

[`SchemaOptional`](SchemaOptional.md)\<`T`, `"optional"` \| `TModifiers`\>

***

### nullable()

> **nullable**(): [`SchemaNullable`](SchemaNullable.md)\<`T`, `"nullable"` \| `TModifiers`\>

Defined in: [core/src/schema/property/types/SchemaString.ts:58](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/types/SchemaString.ts#L58)

#### Returns

[`SchemaNullable`](SchemaNullable.md)\<`T`, `"nullable"` \| `TModifiers`\>

***

### key()

> **key**(): [`SchemaKey`](SchemaKey.md)\<`T`, `"key"` \| `TModifiers`\>

Defined in: [core/src/schema/property/types/SchemaString.ts:62](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/types/SchemaString.ts#L62)

#### Returns

[`SchemaKey`](SchemaKey.md)\<`T`, `"key"` \| `TModifiers`\>

***

### foreignKey()

> **foreignKey**\<`K`\>(`relatingSchema`, `property`): [`SchemaForeignKey`](SchemaForeignKey.md)\<`T`, `TModifiers`, `K`\>

Defined in: [core/src/schema/property/types/SchemaString.ts:66](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/types/SchemaString.ts#L66)

#### Type Parameters

##### K

`K` *extends* `object`

#### Parameters

##### relatingSchema

[`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`K`\>

##### property

keyof `IsEmptyObject`\<\{ \[K in string \| number \| symbol as IsPlainProperty\<K, K\> extends true ? K : never\]: InferPrimitive\<K\[K\]\> \}\> *extends* `true` ? `object` : \{ \[K in string \| number \| symbol as IsPlainProperty\<K, K\> extends true ? K : never\]: InferPrimitive\<K\[K\]\> \} | keyof `IsEmptyObject`\<\{ readonly \[K in string \| number \| symbol as HasModifier\<K, K, "readonly"\> extends true ? K : never\]: InferPrimitive\<K\[K\]\> \}\> *extends* `true` ? `object` : \{ readonly \[K in string \| number \| symbol as HasModifier\<K, K, "readonly"\> extends true ? K : never\]: InferPrimitive\<K\[K\]\> \} | keyof `IsEmptyObject`\<\{ \[K in string \| number \| symbol as HasModifier\<K, K, "optional"\> extends true ? K : never\]?: InferPrimitive\<K\[K\]\> \}\> *extends* `true` ? `object` : \{ \[K in string \| number \| symbol as HasModifier\<K, K, "optional"\> extends true ? K : never\]?: InferPrimitive\<K\[K\]\> \} | keyof `IsEmptyObject`\<\{ \[K in string \| number \| symbol as HasModifier\<K, K, "nullable"\> extends true ? K : never\]: InferPrimitive\<K\[K\]\> \}\> *extends* `true` ? `object` : \{ \[K in string \| number \| symbol as HasModifier\<K, K, "nullable"\> extends true ? K : never\]: InferPrimitive\<K\[K\]\> \}

#### Returns

[`SchemaForeignKey`](SchemaForeignKey.md)\<`T`, `TModifiers`, `K`\>

***

### default()

> **default**\<`I`\>(`value`, `injected?`): [`SchemaDefault`](SchemaDefault.md)\<`T`, `I`, `"default"` \| `TModifiers`\>

Defined in: [core/src/schema/property/types/SchemaString.ts:70](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/types/SchemaString.ts#L70)

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

Defined in: [core/src/schema/property/types/SchemaString.ts:74](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/types/SchemaString.ts#L74)

#### Returns

[`SchemaReadonly`](SchemaReadonly.md)\<`T`, `"readonly"` \| `TModifiers`\>

***

### deserialize()

> **deserialize**(`deserializer`): [`SchemaDeserialize`](SchemaDeserialize.md)\<`T`, `"deserialize"` \| `TModifiers`\>

Defined in: [core/src/schema/property/types/SchemaString.ts:78](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/types/SchemaString.ts#L78)

#### Parameters

##### deserializer

[`PropertyDeserializer`](../type-aliases/PropertyDeserializer.md)\<`T`\>

#### Returns

[`SchemaDeserialize`](SchemaDeserialize.md)\<`T`, `"deserialize"` \| `TModifiers`\>

***

### serialize()

> **serialize**(`serializer`): [`SchemaSerialize`](SchemaSerialize.md)\<`T`, `"serialize"` \| `TModifiers`\>

Defined in: [core/src/schema/property/types/SchemaString.ts:82](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/types/SchemaString.ts#L82)

#### Parameters

##### serializer

[`PropertySerializer`](../type-aliases/PropertySerializer.md)\<`T`\>

#### Returns

[`SchemaSerialize`](SchemaSerialize.md)\<`T`, `"serialize"` \| `TModifiers`\>

***

### identity()

> **identity**(): [`SchemaIdentity`](SchemaIdentity.md)\<`T`, `"identity"` \| `"readonly"` \| `TModifiers`\>

Defined in: [core/src/schema/property/types/SchemaString.ts:86](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/types/SchemaString.ts#L86)

#### Returns

[`SchemaIdentity`](SchemaIdentity.md)\<`T`, `"identity"` \| `"readonly"` \| `TModifiers`\>

***

### array()

> **array**(): [`SchemaArray`](SchemaArray.md)\<`SchemaString`\<`T`, `TModifiers`\>, `TModifiers`\>

Defined in: [core/src/schema/property/types/SchemaString.ts:90](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/types/SchemaString.ts#L90)

#### Returns

[`SchemaArray`](SchemaArray.md)\<`SchemaString`\<`T`, `TModifiers`\>, `TModifiers`\>

***

### index()

> **index**(...`indexes`): [`SchemaIndex`](SchemaIndex.md)\<`T`, `TModifiers`\>

Defined in: [core/src/schema/property/types/SchemaString.ts:94](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/types/SchemaString.ts#L94)

#### Parameters

##### indexes

...`string`[]

#### Returns

[`SchemaIndex`](SchemaIndex.md)\<`T`, `TModifiers`\>

***

### distinct()

> **distinct**(): [`SchemaDistinct`](SchemaDistinct.md)\<`T`, `"distinct"` \| `TModifiers`\>

Defined in: [core/src/schema/property/types/SchemaString.ts:98](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/types/SchemaString.ts#L98)

#### Returns

[`SchemaDistinct`](SchemaDistinct.md)\<`T`, `"distinct"` \| `TModifiers`\>

***

### searchable()

> **searchable**(): [`SchemaSearchable`](SchemaSearchable.md)\<`T`, `"searchable"` \| `TModifiers`\>

Defined in: [core/src/schema/property/types/SchemaString.ts:114](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/types/SchemaString.ts#L114)

Marks this string as eligible for the collection's full-text search index.

```ts
title: s.string().searchable(),
body: s.string({ maxLength: 4000 }).searchable(),
```

Nothing is indexed until the collection declares `.searchIndex()`. Combines with
`.optional()` and `.nullable()` in either sense — an absent or null value contributes no
tokens.

#### Returns

[`SchemaSearchable`](SchemaSearchable.md)\<`T`, `"searchable"` \| `TModifiers`\>

***

### tag()

> **tag**(...`tags`): [`SchemaTag`](SchemaTag.md)\<`T`, `TModifiers`\>

Defined in: [core/src/schema/property/types/SchemaString.ts:118](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/property/types/SchemaString.ts#L118)

#### Parameters

##### tags

...`string`[]

#### Returns

[`SchemaTag`](SchemaTag.md)\<`T`, `TModifiers`\>
