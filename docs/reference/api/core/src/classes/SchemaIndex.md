[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / SchemaIndex

# Class: SchemaIndex\<T, TModifiers\>

Defined in: [core/src/schema/property/modifiers/SchemaIndex.ts:13](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/modifiers/SchemaIndex.ts#L13)

## Extends

- [`SchemaBase`](SchemaBase.md)\<`T`, `TModifiers`\>

## Type Parameters

### T

`T` *extends* `any`

### TModifiers

`TModifiers` *extends* [`SchemaModifiers`](../type-aliases/SchemaModifiers.md)

## Constructors

### Constructor

> **new SchemaIndex**\<`T`, `TModifiers`\>(`current`, ...`indexes`): `SchemaIndex`\<`T`, `TModifiers`\>

Defined in: [core/src/schema/property/modifiers/SchemaIndex.ts:18](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/modifiers/SchemaIndex.ts#L18)

#### Parameters

##### current

[`SchemaBase`](SchemaBase.md)\<`T`, `TModifiers`\>

##### indexes

...`string`[]

#### Returns

`SchemaIndex`\<`T`, `TModifiers`\>

#### Overrides

[`SchemaBase`](SchemaBase.md).[`constructor`](SchemaBase.md#constructor)

## Properties

### modifiers

> **modifiers**: `TModifiers`

Defined in: [core/src/schema/property/base/SchemaBase.ts:6](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L6)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`modifiers`](SchemaBase.md#modifiers)

***

### isNullable

> **isNullable**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:8](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L8)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`isNullable`](SchemaBase.md#isnullable)

***

### isUnmapped

> **isUnmapped**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:9](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L9)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`isUnmapped`](SchemaBase.md#isunmapped)

***

### isOptional

> **isOptional**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:10](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L10)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`isOptional`](SchemaBase.md#isoptional)

***

### isKey

> **isKey**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:11](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L11)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`isKey`](SchemaBase.md#iskey)

***

### isIdentity

> **isIdentity**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:12](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L12)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`isIdentity`](SchemaBase.md#isidentity)

***

### isReadonly

> **isReadonly**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:13](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L13)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`isReadonly`](SchemaBase.md#isreadonly)

***

### isDistict

> **isDistict**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:14](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L14)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`isDistict`](SchemaBase.md#isdistict)

***

### indexes

> **indexes**: `string`[] = `[]`

Defined in: [core/src/schema/property/base/SchemaBase.ts:15](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L15)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`indexes`](SchemaBase.md#indexes)

***

### fromPropertyName

> **fromPropertyName**: `string` = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:16](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L16)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`fromPropertyName`](SchemaBase.md#frompropertyname)

***

### injected

> **injected**: `any` = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:18](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L18)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`injected`](SchemaBase.md#injected)

***

### defaultValue

> **defaultValue**: [`DefaultValue`](../type-aliases/DefaultValue.md)\<`T`\> = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:19](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L19)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`defaultValue`](SchemaBase.md#defaultvalue)

***

### valueSerializer

> **valueSerializer**: [`PropertySerializer`](../type-aliases/PropertySerializer.md)\<`T`\> = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:20](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L20)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`valueSerializer`](SchemaBase.md#valueserializer)

***

### valueDeserializer

> **valueDeserializer**: [`PropertyDeserializer`](../type-aliases/PropertyDeserializer.md)\<`T`\> = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:21](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L21)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`valueDeserializer`](SchemaBase.md#valuedeserializer)

***

### type

> **type**: [`SchemaTypes`](../enumerations/SchemaTypes.md)

Defined in: [core/src/schema/property/base/SchemaBase.ts:22](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L22)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`type`](SchemaBase.md#type)

***

### functionBody

> **functionBody**: [`FunctionBody`](../type-aliases/FunctionBody.md)\<`any`, `T`\>

Defined in: [core/src/schema/property/base/SchemaBase.ts:23](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L23)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`functionBody`](SchemaBase.md#functionbody)

***

### literals

> `readonly` **literals**: `T`[] = `[]`

Defined in: [core/src/schema/property/base/SchemaBase.ts:25](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L25)

#### Inherited from

[`SchemaBase`](SchemaBase.md).[`literals`](SchemaBase.md#literals)

***

### instance

> **instance**: `T`

Defined in: [core/src/schema/property/modifiers/SchemaIndex.ts:15](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/modifiers/SchemaIndex.ts#L15)

#### Overrides

[`SchemaBase`](SchemaBase.md).[`instance`](SchemaBase.md#instance)

## Methods

### optional()

> **optional**(): [`SchemaOptional`](SchemaOptional.md)\<`T`, `"optional"` \| `TModifiers`\>

Defined in: [core/src/schema/property/modifiers/SchemaIndex.ts:29](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/modifiers/SchemaIndex.ts#L29)

#### Returns

[`SchemaOptional`](SchemaOptional.md)\<`T`, `"optional"` \| `TModifiers`\>

***

### nullable()

> **nullable**(): [`SchemaNullable`](SchemaNullable.md)\<`T`, `"nullable"` \| `TModifiers`\>

Defined in: [core/src/schema/property/modifiers/SchemaIndex.ts:33](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/modifiers/SchemaIndex.ts#L33)

#### Returns

[`SchemaNullable`](SchemaNullable.md)\<`T`, `"nullable"` \| `TModifiers`\>

***

### default()

> **default**\<`I`\>(`value`, `injected?`): [`SchemaDefault`](SchemaDefault.md)\<`T`, `I`, `"default"` \| `TModifiers`\>

Defined in: [core/src/schema/property/modifiers/SchemaIndex.ts:37](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/modifiers/SchemaIndex.ts#L37)

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

Defined in: [core/src/schema/property/modifiers/SchemaIndex.ts:41](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/modifiers/SchemaIndex.ts#L41)

#### Returns

[`SchemaReadonly`](SchemaReadonly.md)\<`T`, `"readonly"` \| `TModifiers`\>

***

### deserialize()

> **deserialize**(`deserializer`): [`SchemaDeserialize`](SchemaDeserialize.md)\<`T`, `"deserialize"` \| `TModifiers`\>

Defined in: [core/src/schema/property/modifiers/SchemaIndex.ts:45](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/modifiers/SchemaIndex.ts#L45)

#### Parameters

##### deserializer

[`PropertyDeserializer`](../type-aliases/PropertyDeserializer.md)\<`T`\>

#### Returns

[`SchemaDeserialize`](SchemaDeserialize.md)\<`T`, `"deserialize"` \| `TModifiers`\>

***

### serialize()

> **serialize**(`serializer`): [`SchemaSerialize`](SchemaSerialize.md)\<`T`, `"serialize"` \| `TModifiers`\>

Defined in: [core/src/schema/property/modifiers/SchemaIndex.ts:49](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/modifiers/SchemaIndex.ts#L49)

#### Parameters

##### serializer

[`PropertySerializer`](../type-aliases/PropertySerializer.md)\<`T`\>

#### Returns

[`SchemaSerialize`](SchemaSerialize.md)\<`T`, `"serialize"` \| `TModifiers`\>

***

### distinct()

> **distinct**(): [`SchemaDistinct`](SchemaDistinct.md)\<`T`, `"distinct"` \| `TModifiers`\>

Defined in: [core/src/schema/property/modifiers/SchemaIndex.ts:53](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/modifiers/SchemaIndex.ts#L53)

#### Returns

[`SchemaDistinct`](SchemaDistinct.md)\<`T`, `"distinct"` \| `TModifiers`\>

***

### from()

> **from**(`propertyName`): [`SchemaFrom`](SchemaFrom.md)\<`T`, `TModifiers`\>

Defined in: [core/src/schema/property/modifiers/SchemaIndex.ts:57](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/modifiers/SchemaIndex.ts#L57)

#### Parameters

##### propertyName

`string`

#### Returns

[`SchemaFrom`](SchemaFrom.md)\<`T`, `TModifiers`\>
