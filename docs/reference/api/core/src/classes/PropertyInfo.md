[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / PropertyInfo

# Class: PropertyInfo\<T\>

Defined in: [core/src/schema/PropertyInfo.ts:8](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/PropertyInfo.ts#L8)

Represents metadata and utilities for a property in a schema, including its type, name, parent, children, and serialization details.

## Type Parameters

### T

`T` *extends* `object`

## Constructors

### Constructor

> **new PropertyInfo**\<`T`\>(`schema`, `name`, `parent?`): `PropertyInfo`\<`T`\>

Defined in: [core/src/schema/PropertyInfo.ts:72](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/PropertyInfo.ts#L72)

#### Parameters

##### schema

[`SchemaBase`](SchemaBase.md)\<`T`, `any`\>

##### name

`string`

##### parent?

`PropertyInfo`\<`T`\>

#### Returns

`PropertyInfo`\<`T`\>

## Properties

### name

> `readonly` **name**: `string`

Defined in: [core/src/schema/PropertyInfo.ts:19](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/PropertyInfo.ts#L19)

The name of the property.

***

### from

> `readonly` **from**: `string` = `null`

Defined in: [core/src/schema/PropertyInfo.ts:21](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/PropertyInfo.ts#L21)

The name of the property we need to map from.

***

### type

> `readonly` **type**: [`SchemaTypes`](../enumerations/SchemaTypes.md)

Defined in: [core/src/schema/PropertyInfo.ts:23](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/PropertyInfo.ts#L23)

The schema type of the property.

***

### isNullable

> `readonly` **isNullable**: `boolean`

Defined in: [core/src/schema/PropertyInfo.ts:26](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/PropertyInfo.ts#L26)

Whether the property can be null.

***

### isOptional

> `readonly` **isOptional**: `boolean`

Defined in: [core/src/schema/PropertyInfo.ts:28](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/PropertyInfo.ts#L28)

Whether the property is optional.

***

### isKey

> `readonly` **isKey**: `boolean`

Defined in: [core/src/schema/PropertyInfo.ts:30](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/PropertyInfo.ts#L30)

Whether the property is a key.

***

### isIdentity

> `readonly` **isIdentity**: `boolean`

Defined in: [core/src/schema/PropertyInfo.ts:32](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/PropertyInfo.ts#L32)

Whether the property is an identity property.

***

### isReadonly

> `readonly` **isReadonly**: `boolean`

Defined in: [core/src/schema/PropertyInfo.ts:34](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/PropertyInfo.ts#L34)

Whether the property is readonly.

***

### isUnmapped

> `readonly` **isUnmapped**: `boolean`

Defined in: [core/src/schema/PropertyInfo.ts:36](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/PropertyInfo.ts#L36)

Whether the property is unmapped.

***

### isDistinct

> `readonly` **isDistinct**: `boolean`

Defined in: [core/src/schema/PropertyInfo.ts:38](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/PropertyInfo.ts#L38)

Whether the property is distinct.

***

### indexes

> `readonly` **indexes**: `string`[]

Defined in: [core/src/schema/PropertyInfo.ts:40](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/PropertyInfo.ts#L40)

Indexes associated with the property.

***

### injected

> `readonly` **injected**: `any` = `null`

Defined in: [core/src/schema/PropertyInfo.ts:43](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/PropertyInfo.ts#L43)

Any injected value for the property.

***

### defaultValue

> `readonly` **defaultValue**: `any` = `null`

Defined in: [core/src/schema/PropertyInfo.ts:45](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/PropertyInfo.ts#L45)

The default value for the property, if any.

***

### valueSerializer

> `readonly` **valueSerializer**: [`PropertySerializer`](../type-aliases/PropertySerializer.md)\<`T`\> = `null`

Defined in: [core/src/schema/PropertyInfo.ts:47](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/PropertyInfo.ts#L47)

Serializer for the property value, if any.

***

### valueDeserializer

> `readonly` **valueDeserializer**: [`PropertyDeserializer`](../type-aliases/PropertyDeserializer.md)\<`T`\> = `null`

Defined in: [core/src/schema/PropertyInfo.ts:49](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/PropertyInfo.ts#L49)

Deserializer for the property value, if any.

***

### functionBody

> `readonly` **functionBody**: [`FunctionBody`](../type-aliases/FunctionBody.md)\<`any`, `T`\>

Defined in: [core/src/schema/PropertyInfo.ts:51](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/PropertyInfo.ts#L51)

Function body for computed properties, if any.

***

### children

> `readonly` **children**: `PropertyInfo`\<`T`\>[] = `[]`

Defined in: [core/src/schema/PropertyInfo.ts:53](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/PropertyInfo.ts#L53)

Child properties of this property.

***

### schema

> `readonly` **schema**: [`SchemaBase`](SchemaBase.md)\<`T`, `any`\>

Defined in: [core/src/schema/PropertyInfo.ts:55](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/PropertyInfo.ts#L55)

The schema this property belongs to.

***

### innerSchema?

> `readonly` `optional` **innerSchema**: [`SchemaBase`](SchemaBase.md)\<`unknown`, `any`\>

Defined in: [core/src/schema/PropertyInfo.ts:57](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/PropertyInfo.ts#L57)

The inner schema if this property is an array.

***

### literals

> `readonly` **literals**: `T`[]

Defined in: [core/src/schema/PropertyInfo.ts:59](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/PropertyInfo.ts#L59)

Literal values allowed for this property.

***

### parent?

> `readonly` `optional` **parent**: `PropertyInfo`\<`T`\>

Defined in: [core/src/schema/PropertyInfo.ts:62](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/PropertyInfo.ts#L62)

The parent property, if any.

## Accessors

### id

#### Get Signature

> **get** **id**(): `string`

Defined in: [core/src/schema/PropertyInfo.ts:10](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/PropertyInfo.ts#L10)

##### Returns

`string`

***

### level

#### Get Signature

> **get** **level**(): `number`

Defined in: [core/src/schema/PropertyInfo.ts:109](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/PropertyInfo.ts#L109)

Returns the depth (level) of this property in the property tree.

The root property has a level of 0. Each child property increases the level by 1.
Traverses up the parent chain, incrementing the level for each parent until the root is reached.

##### Returns

`number`

The number of parent properties above this property (0 for root).

***

### hasNullableParents

#### Get Signature

> **get** **hasNullableParents**(): `boolean`

Defined in: [core/src/schema/PropertyInfo.ts:221](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/PropertyInfo.ts#L221)

Returns true if any parent property is nullable or optional.

##### Returns

`boolean`

True if any parent is nullable or optional, false otherwise.

***

### hasIdentityChildren

#### Get Signature

> **get** **hasIdentityChildren**(): `boolean`

Defined in: [core/src/schema/PropertyInfo.ts:244](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/PropertyInfo.ts#L244)

Returns true if any child property (recursively) is an identity property.

##### Returns

`boolean`

True if any child is an identity property, false otherwise.

## Methods

### getPathArray()

> **getPathArray**(): `string`[]

Defined in: [core/src/schema/PropertyInfo.ts:178](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/PropertyInfo.ts#L178)

Returns an array of property names representing the path from the root to this property.

#### Returns

`string`[]

The property path as an array of names.

***

### getParentPathArray()

> **getParentPathArray**(): `string`[]

Defined in: [core/src/schema/PropertyInfo.ts:199](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/PropertyInfo.ts#L199)

Returns an array of property names representing the path from the root to the parent of this property.

#### Returns

`string`[]

The property path as an array of names, excluding this property.

***

### getValue()

> **getValue**(`instance`): `any`

Defined in: [core/src/schema/PropertyInfo.ts:264](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/PropertyInfo.ts#L264)

Gets the value of this property from the given instance, following the property path.

#### Parameters

##### instance

`unknown`

The object instance to retrieve the value from.

#### Returns

`any`

The value of the property, or null if not found.

***

### setValue()

> **setValue**(`instance`, `value`): `void`

Defined in: [core/src/schema/PropertyInfo.ts:285](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/PropertyInfo.ts#L285)

Sets the value of this property on the given instance, creating intermediate objects as needed.

#### Parameters

##### instance

`unknown`

The object instance to set the value on.

##### value

`unknown`

The value to set.

#### Returns

`void`

***

### getSelectrorPath()

> **getSelectrorPath**(`options`): `string`

Defined in: [core/src/schema/PropertyInfo.ts:320](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/PropertyInfo.ts#L320)

Returns a selector path string for this property, starting from the given parent variable name.

#### Parameters

##### options

###### parent

`string`

The root variable name.

###### assignmentType?

`AssignmentType`

Optional assignment type for path resolution.

###### useFromPropertyName?

`boolean`

#### Returns

`string`

The selector path string (e.g., 'parent.prop1.prop2').

***

### getAssignmentPath()

> **getAssignmentPath**(`options?`): `string`

Defined in: [core/src/schema/PropertyInfo.ts:335](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/PropertyInfo.ts#L335)

Returns an assignment path string for this property, optionally starting from a parent variable name.

#### Parameters

##### options?

###### parent?

`string`

Optional root variable name.

###### useFromPropertyName?

`boolean`

#### Returns

`string`

The assignment path string (e.g., 'prop1.prop2').

***

### deserialize()

> **deserialize**(`value`): `string` \| `number` \| `boolean` \| `Date` \| `T`

Defined in: [core/src/schema/PropertyInfo.ts:349](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/schema/PropertyInfo.ts#L349)

#### Parameters

##### value

`string` | `number`

#### Returns

`string` \| `number` \| `boolean` \| `Date` \| `T`
