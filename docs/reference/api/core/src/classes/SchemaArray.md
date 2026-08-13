[**routier-collection**](/reference/api/README)

***

[routier-collection](/reference/api/README) / [core/src](/reference/api/core/src/README) / SchemaArray

# Class: SchemaArray\<T, TModifiers\>

Defined in: [core/src/schema/property/types/SchemaArray.ts:11](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/types/SchemaArray.ts#L11)

## Extends

- [`SchemaBase`](/reference/api/core/src/classes/SchemaBase)\<`T`[], `TModifiers`\>

## Type Parameters

### T

`T` *extends* `any`

### TModifiers

`TModifiers` *extends* [`SchemaModifiers`](/reference/api/core/src/type-aliases/SchemaModifiers)

## Constructors

### Constructor

> **new SchemaArray**\<`T`, `TModifiers`\>(`entity?`, `literals?`): `SchemaArray`\<`T`, `TModifiers`\>

Defined in: [core/src/schema/property/types/SchemaArray.ts:18](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/types/SchemaArray.ts#L18)

#### Parameters

##### entity?

[`SchemaBase`](/reference/api/core/src/classes/SchemaBase)\<`T`[], `TModifiers`\>

##### literals?

`T`[][]

#### Returns

`SchemaArray`\<`T`, `TModifiers`\>

#### Overrides

[`SchemaBase`](/reference/api/core/src/classes/SchemaBase).[`constructor`](/reference/api/core/src/classes/SchemaBase#constructor)

## Properties

### modifiers

> **modifiers**: `TModifiers`

Defined in: [core/src/schema/property/base/SchemaBase.ts:6](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L6)

#### Inherited from

[`SchemaBase`](/reference/api/core/src/classes/SchemaBase).[`modifiers`](/reference/api/core/src/classes/SchemaBase#modifiers)

***

### isNullable

> **isNullable**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:8](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L8)

#### Inherited from

[`SchemaBase`](/reference/api/core/src/classes/SchemaBase).[`isNullable`](/reference/api/core/src/classes/SchemaBase#isnullable)

***

### isUnmapped

> **isUnmapped**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:9](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L9)

#### Inherited from

[`SchemaBase`](/reference/api/core/src/classes/SchemaBase).[`isUnmapped`](/reference/api/core/src/classes/SchemaBase#isunmapped)

***

### isOptional

> **isOptional**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:10](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L10)

#### Inherited from

[`SchemaBase`](/reference/api/core/src/classes/SchemaBase).[`isOptional`](/reference/api/core/src/classes/SchemaBase#isoptional)

***

### isKey

> **isKey**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:11](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L11)

#### Inherited from

[`SchemaBase`](/reference/api/core/src/classes/SchemaBase).[`isKey`](/reference/api/core/src/classes/SchemaBase#iskey)

***

### isIdentity

> **isIdentity**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:12](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L12)

#### Inherited from

[`SchemaBase`](/reference/api/core/src/classes/SchemaBase).[`isIdentity`](/reference/api/core/src/classes/SchemaBase#isidentity)

***

### isReadonly

> **isReadonly**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:13](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L13)

#### Inherited from

[`SchemaBase`](/reference/api/core/src/classes/SchemaBase).[`isReadonly`](/reference/api/core/src/classes/SchemaBase#isreadonly)

***

### isDistict

> **isDistict**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:14](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L14)

#### Inherited from

[`SchemaBase`](/reference/api/core/src/classes/SchemaBase).[`isDistict`](/reference/api/core/src/classes/SchemaBase#isdistict)

***

### indexes

> **indexes**: `string`[] = `[]`

Defined in: [core/src/schema/property/base/SchemaBase.ts:15](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L15)

#### Inherited from

[`SchemaBase`](/reference/api/core/src/classes/SchemaBase).[`indexes`](/reference/api/core/src/classes/SchemaBase#indexes)

***

### fromPropertyName

> **fromPropertyName**: `string` = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:16](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L16)

#### Inherited from

[`SchemaBase`](/reference/api/core/src/classes/SchemaBase).[`fromPropertyName`](/reference/api/core/src/classes/SchemaBase#frompropertyname)

***

### injected

> **injected**: `any` = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:18](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L18)

#### Inherited from

[`SchemaBase`](/reference/api/core/src/classes/SchemaBase).[`injected`](/reference/api/core/src/classes/SchemaBase#injected)

***

### defaultValue

> **defaultValue**: [`DefaultValue`](/reference/api/core/src/type-aliases/DefaultValue)\<`T`[]\> = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:19](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L19)

#### Inherited from

[`SchemaBase`](/reference/api/core/src/classes/SchemaBase).[`defaultValue`](/reference/api/core/src/classes/SchemaBase#defaultvalue)

***

### valueSerializer

> **valueSerializer**: [`PropertySerializer`](/reference/api/core/src/type-aliases/PropertySerializer)\<`T`[]\> = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:20](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L20)

#### Inherited from

[`SchemaBase`](/reference/api/core/src/classes/SchemaBase).[`valueSerializer`](/reference/api/core/src/classes/SchemaBase#valueserializer)

***

### valueDeserializer

> **valueDeserializer**: [`PropertyDeserializer`](/reference/api/core/src/type-aliases/PropertyDeserializer)\<`T`[]\> = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:21](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L21)

#### Inherited from

[`SchemaBase`](/reference/api/core/src/classes/SchemaBase).[`valueDeserializer`](/reference/api/core/src/classes/SchemaBase#valuedeserializer)

***

### functionBody

> **functionBody**: [`FunctionBody`](/reference/api/core/src/type-aliases/FunctionBody)\<`any`, `T`[]\>

Defined in: [core/src/schema/property/base/SchemaBase.ts:23](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L23)

#### Inherited from

[`SchemaBase`](/reference/api/core/src/classes/SchemaBase).[`functionBody`](/reference/api/core/src/classes/SchemaBase#functionbody)

***

### literals

> `readonly` **literals**: `T`[][] = `[]`

Defined in: [core/src/schema/property/base/SchemaBase.ts:25](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L25)

#### Inherited from

[`SchemaBase`](/reference/api/core/src/classes/SchemaBase).[`literals`](/reference/api/core/src/classes/SchemaBase#literals)

***

### instance

> **instance**: `T`[]

Defined in: [core/src/schema/property/types/SchemaArray.ts:13](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/types/SchemaArray.ts#L13)

#### Overrides

[`SchemaBase`](/reference/api/core/src/classes/SchemaBase).[`instance`](/reference/api/core/src/classes/SchemaBase#instance)

***

### type

> **type**: [`SchemaTypes`](/reference/api/core/src/enumerations/SchemaTypes) = `SchemaTypes.Array`

Defined in: [core/src/schema/property/types/SchemaArray.ts:14](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/types/SchemaArray.ts#L14)

#### Overrides

[`SchemaBase`](/reference/api/core/src/classes/SchemaBase).[`type`](/reference/api/core/src/classes/SchemaBase#type)

***

### innerSchema?

> `readonly` `optional` **innerSchema**: [`SchemaBase`](/reference/api/core/src/classes/SchemaBase)\<`any`, `any`\>

Defined in: [core/src/schema/property/types/SchemaArray.ts:16](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/types/SchemaArray.ts#L16)

## Methods

### from()

> **from**(`propertyName`): [`SchemaFrom`](/reference/api/core/src/classes/SchemaFrom)\<`T`[], `TModifiers`\>

Defined in: [core/src/schema/property/types/SchemaArray.ts:23](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/types/SchemaArray.ts#L23)

#### Parameters

##### propertyName

`string`

#### Returns

[`SchemaFrom`](/reference/api/core/src/classes/SchemaFrom)\<`T`[], `TModifiers`\>

***

### optional()

> **optional**(): [`SchemaOptional`](/reference/api/core/src/classes/SchemaOptional)\<`T`[], `"optional"` \| `TModifiers`\>

Defined in: [core/src/schema/property/types/SchemaArray.ts:27](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/types/SchemaArray.ts#L27)

#### Returns

[`SchemaOptional`](/reference/api/core/src/classes/SchemaOptional)\<`T`[], `"optional"` \| `TModifiers`\>

***

### nullable()

> **nullable**(): [`SchemaNullable`](/reference/api/core/src/classes/SchemaNullable)\<`T`[], `"nullable"` \| `TModifiers`\>

Defined in: [core/src/schema/property/types/SchemaArray.ts:31](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/types/SchemaArray.ts#L31)

#### Returns

[`SchemaNullable`](/reference/api/core/src/classes/SchemaNullable)\<`T`[], `"nullable"` \| `TModifiers`\>

***

### default()

> **default**\<`I`\>(`value`, `injected?`): [`SchemaDefault`](/reference/api/core/src/classes/SchemaDefault)\<`T`[], `I`, `"default"` \| `TModifiers`\>

Defined in: [core/src/schema/property/types/SchemaArray.ts:35](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/types/SchemaArray.ts#L35)

#### Type Parameters

##### I

`I` = `never`

#### Parameters

##### value

[`DefaultValue`](/reference/api/core/src/type-aliases/DefaultValue)\<`T`[], `I`\>

##### injected?

`I`

#### Returns

[`SchemaDefault`](/reference/api/core/src/classes/SchemaDefault)\<`T`[], `I`, `"default"` \| `TModifiers`\>

***

### deserialize()

> **deserialize**(`deserializer`): [`SchemaDeserialize`](/reference/api/core/src/classes/SchemaDeserialize)\<`T`[], `"deserialize"` \| `TModifiers`\>

Defined in: [core/src/schema/property/types/SchemaArray.ts:39](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/types/SchemaArray.ts#L39)

#### Parameters

##### deserializer

[`PropertyDeserializer`](/reference/api/core/src/type-aliases/PropertyDeserializer)\<`T`[]\>

#### Returns

[`SchemaDeserialize`](/reference/api/core/src/classes/SchemaDeserialize)\<`T`[], `"deserialize"` \| `TModifiers`\>

***

### serialize()

> **serialize**(`serializer`): [`SchemaSerialize`](/reference/api/core/src/classes/SchemaSerialize)\<`T`[], `"serialize"` \| `TModifiers`\>

Defined in: [core/src/schema/property/types/SchemaArray.ts:43](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/types/SchemaArray.ts#L43)

#### Parameters

##### serializer

[`PropertySerializer`](/reference/api/core/src/type-aliases/PropertySerializer)\<`T`[]\>

#### Returns

[`SchemaSerialize`](/reference/api/core/src/classes/SchemaSerialize)\<`T`[], `"serialize"` \| `TModifiers`\>

***

### index()

> **index**(...`indexes`): [`SchemaIndex`](/reference/api/core/src/classes/SchemaIndex)\<`T`[], `TModifiers`\>

Defined in: [core/src/schema/property/types/SchemaArray.ts:47](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/types/SchemaArray.ts#L47)

#### Parameters

##### indexes

...`string`[]

#### Returns

[`SchemaIndex`](/reference/api/core/src/classes/SchemaIndex)\<`T`[], `TModifiers`\>
