[**routier-collection**](/reference/api/README)

***

[routier-collection](/reference/api/README) / [core/src](/reference/api/core/src/README) / SchemaObject

# Class: SchemaObject\<T, TModifiers\>

Defined in: [core/src/schema/property/types/SchemaObject.ts:10](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/types/SchemaObject.ts#L10)

## Extends

- [`SchemaBase`](/reference/api/core/src/classes/SchemaBase)\<`T`, `TModifiers`\>

## Type Parameters

### T

`T` *extends* `object`

### TModifiers

`TModifiers` *extends* [`SchemaModifiers`](/reference/api/core/src/type-aliases/SchemaModifiers)

## Constructors

### Constructor

> **new SchemaObject**\<`T`, `TModifiers`\>(`schema`): `SchemaObject`\<`T`, `TModifiers`\>

Defined in: [core/src/schema/property/types/SchemaObject.ts:16](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/types/SchemaObject.ts#L16)

#### Parameters

##### schema

`T`

#### Returns

`SchemaObject`\<`T`, `TModifiers`\>

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

Defined in: [core/src/schema/property/types/SchemaObject.ts:12](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/types/SchemaObject.ts#L12)

#### Overrides

[`SchemaBase`](/reference/api/core/src/classes/SchemaBase).[`instance`](/reference/api/core/src/classes/SchemaBase#instance)

***

### type

> **type**: [`SchemaTypes`](/reference/api/core/src/enumerations/SchemaTypes) = `SchemaTypes.Object`

Defined in: [core/src/schema/property/types/SchemaObject.ts:13](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/types/SchemaObject.ts#L13)

#### Overrides

[`SchemaBase`](/reference/api/core/src/classes/SchemaBase).[`type`](/reference/api/core/src/classes/SchemaBase#type)

## Methods

### from()

> **from**(`propertyName`): [`SchemaFrom`](/reference/api/core/src/classes/SchemaFrom)\<`T`, `TModifiers`\>

Defined in: [core/src/schema/property/types/SchemaObject.ts:21](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/types/SchemaObject.ts#L21)

#### Parameters

##### propertyName

`string`

#### Returns

[`SchemaFrom`](/reference/api/core/src/classes/SchemaFrom)\<`T`, `TModifiers`\>

***

### optional()

> **optional**(): [`SchemaOptional`](/reference/api/core/src/classes/SchemaOptional)\<`T`, `"optional"` \| `TModifiers`\>

Defined in: [core/src/schema/property/types/SchemaObject.ts:25](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/types/SchemaObject.ts#L25)

#### Returns

[`SchemaOptional`](/reference/api/core/src/classes/SchemaOptional)\<`T`, `"optional"` \| `TModifiers`\>

***

### nullable()

> **nullable**(): [`SchemaNullable`](/reference/api/core/src/classes/SchemaNullable)\<`T`, `"nullable"` \| `TModifiers`\>

Defined in: [core/src/schema/property/types/SchemaObject.ts:29](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/types/SchemaObject.ts#L29)

#### Returns

[`SchemaNullable`](/reference/api/core/src/classes/SchemaNullable)\<`T`, `"nullable"` \| `TModifiers`\>

***

### default()

> **default**\<`I`\>(`value`, `injected?`): [`SchemaDefault`](/reference/api/core/src/classes/SchemaDefault)\<`T`, `I`, `"default"` \| `TModifiers`\>

Defined in: [core/src/schema/property/types/SchemaObject.ts:33](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/types/SchemaObject.ts#L33)

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

### identity()

> **identity**(): [`SchemaIdentity`](/reference/api/core/src/classes/SchemaIdentity)\<`T`, `"identity"` \| `"readonly"` \| `TModifiers`\>

Defined in: [core/src/schema/property/types/SchemaObject.ts:37](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/types/SchemaObject.ts#L37)

#### Returns

[`SchemaIdentity`](/reference/api/core/src/classes/SchemaIdentity)\<`T`, `"identity"` \| `"readonly"` \| `TModifiers`\>

***

### array()

> **array**(): [`SchemaArray`](/reference/api/core/src/classes/SchemaArray)\<`SchemaObject`\<`T`, `TModifiers`\>, `TModifiers`\>

Defined in: [core/src/schema/property/types/SchemaObject.ts:41](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/types/SchemaObject.ts#L41)

#### Returns

[`SchemaArray`](/reference/api/core/src/classes/SchemaArray)\<`SchemaObject`\<`T`, `TModifiers`\>, `TModifiers`\>
