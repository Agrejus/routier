[**routier-collection**](/reference/api/README)

***

[routier-collection](/reference/api/README) / [core/src](/reference/api/core/src/README) / SchemaKey

# Class: SchemaKey\<T, TModifiers\>

Defined in: [core/src/schema/property/modifiers/SchemaKey.ts:7](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/modifiers/SchemaKey.ts#L7)

## Extends

- [`SchemaBase`](/reference/api/core/src/classes/SchemaBase)\<`T`, `TModifiers`\>

## Type Parameters

### T

`T` *extends* [`IdType`](/reference/api/core/src/type-aliases/IdType)

### TModifiers

`TModifiers` *extends* [`SchemaModifiers`](/reference/api/core/src/type-aliases/SchemaModifiers)

## Constructors

### Constructor

> **new SchemaKey**\<`T`, `TModifiers`\>(`current`): `SchemaKey`\<`T`, `TModifiers`\>

Defined in: [core/src/schema/property/modifiers/SchemaKey.ts:11](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/modifiers/SchemaKey.ts#L11)

#### Parameters

##### current

[`SchemaBase`](/reference/api/core/src/classes/SchemaBase)\<`T`, `TModifiers`\>

#### Returns

`SchemaKey`\<`T`, `TModifiers`\>

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

> **defaultValue**: [`DefaultValue`](/reference/api/core/src/type-aliases/DefaultValue)\<`T`\> = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:19](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L19)

#### Inherited from

[`SchemaBase`](/reference/api/core/src/classes/SchemaBase).[`defaultValue`](/reference/api/core/src/classes/SchemaBase#defaultvalue)

***

### valueSerializer

> **valueSerializer**: [`PropertySerializer`](/reference/api/core/src/type-aliases/PropertySerializer)\<`T`\> = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:20](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L20)

#### Inherited from

[`SchemaBase`](/reference/api/core/src/classes/SchemaBase).[`valueSerializer`](/reference/api/core/src/classes/SchemaBase#valueserializer)

***

### valueDeserializer

> **valueDeserializer**: [`PropertyDeserializer`](/reference/api/core/src/type-aliases/PropertyDeserializer)\<`T`\> = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:21](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L21)

#### Inherited from

[`SchemaBase`](/reference/api/core/src/classes/SchemaBase).[`valueDeserializer`](/reference/api/core/src/classes/SchemaBase#valuedeserializer)

***

### type

> **type**: [`SchemaTypes`](/reference/api/core/src/enumerations/SchemaTypes)

Defined in: [core/src/schema/property/base/SchemaBase.ts:22](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L22)

#### Inherited from

[`SchemaBase`](/reference/api/core/src/classes/SchemaBase).[`type`](/reference/api/core/src/classes/SchemaBase#type)

***

### functionBody

> **functionBody**: [`FunctionBody`](/reference/api/core/src/type-aliases/FunctionBody)\<`any`, `T`\>

Defined in: [core/src/schema/property/base/SchemaBase.ts:23](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L23)

#### Inherited from

[`SchemaBase`](/reference/api/core/src/classes/SchemaBase).[`functionBody`](/reference/api/core/src/classes/SchemaBase#functionbody)

***

### literals

> `readonly` **literals**: `T`[] = `[]`

Defined in: [core/src/schema/property/base/SchemaBase.ts:25](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L25)

#### Inherited from

[`SchemaBase`](/reference/api/core/src/classes/SchemaBase).[`literals`](/reference/api/core/src/classes/SchemaBase#literals)

***

### instance

> **instance**: `T`

Defined in: [core/src/schema/property/modifiers/SchemaKey.ts:8](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/modifiers/SchemaKey.ts#L8)

#### Overrides

[`SchemaBase`](/reference/api/core/src/classes/SchemaBase).[`instance`](/reference/api/core/src/classes/SchemaBase#instance)

## Methods

### identity()

> **identity**(): [`SchemaIdentity`](/reference/api/core/src/classes/SchemaIdentity)\<`T`, `"identity"` \| `TModifiers`\>

Defined in: [core/src/schema/property/modifiers/SchemaKey.ts:17](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/modifiers/SchemaKey.ts#L17)

#### Returns

[`SchemaIdentity`](/reference/api/core/src/classes/SchemaIdentity)\<`T`, `"identity"` \| `TModifiers`\>

***

### default()

> **default**\<`I`\>(`value`, `injected?`): [`SchemaDefault`](/reference/api/core/src/classes/SchemaDefault)\<`T`, `I`, `"default"` \| `TModifiers`\>

Defined in: [core/src/schema/property/modifiers/SchemaKey.ts:21](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/modifiers/SchemaKey.ts#L21)

#### Type Parameters

##### I

`I` = `never`

#### Parameters

##### value

[`DefaultValue`](/reference/api/core/src/type-aliases/DefaultValue)\<`T`, `I`\>

##### injected?

`I`

#### Returns

[`SchemaDefault`](/reference/api/core/src/classes/SchemaDefault)\<`T`, `I`, `"default"` \| `TModifiers`\>

***

### from()

> **from**(`propertyName`): [`SchemaFrom`](/reference/api/core/src/classes/SchemaFrom)\<`T`, `TModifiers`\>

Defined in: [core/src/schema/property/modifiers/SchemaKey.ts:25](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/modifiers/SchemaKey.ts#L25)

#### Parameters

##### propertyName

`string`

#### Returns

[`SchemaFrom`](/reference/api/core/src/classes/SchemaFrom)\<`T`, `TModifiers`\>
