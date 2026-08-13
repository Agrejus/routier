[**routier-collection**](/reference/api/README)

***

[routier-collection](/reference/api/README) / [core/src](/reference/api/core/src/README) / SchemaBase

# Abstract Class: SchemaBase\<T, TModifiers\>

Defined in: [core/src/schema/property/base/SchemaBase.ts:3](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L3)

## Extended by

- [`SchemaComputed`](/reference/api/core/src/classes/SchemaComputed)
- [`SchemaFunction`](/reference/api/core/src/classes/SchemaFunction)
- [`SchemaDefault`](/reference/api/core/src/classes/SchemaDefault)
- [`SchemaDeserialize`](/reference/api/core/src/classes/SchemaDeserialize)
- [`SchemaDistinct`](/reference/api/core/src/classes/SchemaDistinct)
- [`SchemaIdentity`](/reference/api/core/src/classes/SchemaIdentity)
- [`SchemaIndex`](/reference/api/core/src/classes/SchemaIndex)
- [`SchemaKey`](/reference/api/core/src/classes/SchemaKey)
- [`SchemaNullable`](/reference/api/core/src/classes/SchemaNullable)
- [`SchemaOptional`](/reference/api/core/src/classes/SchemaOptional)
- [`SchemaReadonly`](/reference/api/core/src/classes/SchemaReadonly)
- [`SchemaSerialize`](/reference/api/core/src/classes/SchemaSerialize)
- [`SchemaTracked`](/reference/api/core/src/classes/SchemaTracked)
- [`SchemaFrom`](/reference/api/core/src/classes/SchemaFrom)
- [`SchemaArray`](/reference/api/core/src/classes/SchemaArray)
- [`SchemaBoolean`](/reference/api/core/src/classes/SchemaBoolean)
- [`SchemaDate`](/reference/api/core/src/classes/SchemaDate)
- [`SchemaNumber`](/reference/api/core/src/classes/SchemaNumber)
- [`SchemaObject`](/reference/api/core/src/classes/SchemaObject)
- [`SchemaString`](/reference/api/core/src/classes/SchemaString)

## Type Parameters

### T

`T` *extends* `any`

### TModifiers

`TModifiers` *extends* [`SchemaModifiers`](/reference/api/core/src/type-aliases/SchemaModifiers)

## Constructors

### Constructor

> **new SchemaBase**\<`T`, `TModifiers`\>(`entity?`, `literals?`): `SchemaBase`\<`T`, `TModifiers`\>

Defined in: [core/src/schema/property/base/SchemaBase.ts:27](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L27)

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

Defined in: [core/src/schema/property/base/SchemaBase.ts:5](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L5)

***

### modifiers

> **modifiers**: `TModifiers`

Defined in: [core/src/schema/property/base/SchemaBase.ts:6](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L6)

***

### isNullable

> **isNullable**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:8](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L8)

***

### isUnmapped

> **isUnmapped**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:9](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L9)

***

### isOptional

> **isOptional**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:10](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L10)

***

### isKey

> **isKey**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:11](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L11)

***

### isIdentity

> **isIdentity**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:12](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L12)

***

### isReadonly

> **isReadonly**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:13](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L13)

***

### isDistict

> **isDistict**: `boolean` = `false`

Defined in: [core/src/schema/property/base/SchemaBase.ts:14](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L14)

***

### indexes

> **indexes**: `string`[] = `[]`

Defined in: [core/src/schema/property/base/SchemaBase.ts:15](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L15)

***

### fromPropertyName

> **fromPropertyName**: `string` = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:16](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L16)

***

### injected

> **injected**: `any` = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:18](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L18)

***

### defaultValue

> **defaultValue**: [`DefaultValue`](/reference/api/core/src/type-aliases/DefaultValue)\<`T`\> = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:19](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L19)

***

### valueSerializer

> **valueSerializer**: [`PropertySerializer`](/reference/api/core/src/type-aliases/PropertySerializer)\<`T`\> = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:20](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L20)

***

### valueDeserializer

> **valueDeserializer**: [`PropertyDeserializer`](/reference/api/core/src/type-aliases/PropertyDeserializer)\<`T`\> = `null`

Defined in: [core/src/schema/property/base/SchemaBase.ts:21](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L21)

***

### type

> **type**: [`SchemaTypes`](/reference/api/core/src/enumerations/SchemaTypes)

Defined in: [core/src/schema/property/base/SchemaBase.ts:22](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L22)

***

### functionBody

> **functionBody**: [`FunctionBody`](/reference/api/core/src/type-aliases/FunctionBody)\<`any`, `T`\>

Defined in: [core/src/schema/property/base/SchemaBase.ts:23](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L23)

***

### literals

> `readonly` **literals**: `T`[] = `[]`

Defined in: [core/src/schema/property/base/SchemaBase.ts:25](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/property/base/SchemaBase.ts#L25)
