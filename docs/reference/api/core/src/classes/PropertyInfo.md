[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / PropertyInfo

# Class: PropertyInfo\<T\>

Defined in: [core/src/schema/PropertyInfo.ts:16](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L16)

Represents metadata and utilities for a property in a schema, including its type, name, parent, children, and serialization details.

## Type Parameters

### T

`T` *extends* `object`

## Constructors

### Constructor

> **new PropertyInfo**\<`T`\>(`schema`, `name`, `parent?`): `PropertyInfo`\<`T`\>

Defined in: [core/src/schema/PropertyInfo.ts:106](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L106)

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

Defined in: [core/src/schema/PropertyInfo.ts:27](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L27)

The name of the property.

***

### from

> `readonly` **from**: `string` = `null`

Defined in: [core/src/schema/PropertyInfo.ts:29](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L29)

The name of the property we need to map from.

***

### type

> `readonly` **type**: [`SchemaTypes`](../enumerations/SchemaTypes.md)

Defined in: [core/src/schema/PropertyInfo.ts:31](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L31)

The schema type of the property.

***

### isNullable

> `readonly` **isNullable**: `boolean`

Defined in: [core/src/schema/PropertyInfo.ts:34](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L34)

Whether the property can be null.

***

### isOptional

> `readonly` **isOptional**: `boolean`

Defined in: [core/src/schema/PropertyInfo.ts:36](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L36)

Whether the property is optional.

***

### isKey

> `readonly` **isKey**: `boolean`

Defined in: [core/src/schema/PropertyInfo.ts:38](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L38)

Whether the property is a key.

***

### foreignKeyDefinition

> `readonly` **foreignKeyDefinition**: [`ForeignKey`](../type-aliases/ForeignKey.md)\<`unknown`\>

Defined in: [core/src/schema/PropertyInfo.ts:40](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L40)

Foreign key schema and property

***

### isIdentity

> `readonly` **isIdentity**: `boolean`

Defined in: [core/src/schema/PropertyInfo.ts:42](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L42)

Whether the property is an identity property.

***

### isReadonly

> `readonly` **isReadonly**: `boolean`

Defined in: [core/src/schema/PropertyInfo.ts:44](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L44)

Whether the property is readonly.

***

### isUnmapped

> `readonly` **isUnmapped**: `boolean`

Defined in: [core/src/schema/PropertyInfo.ts:46](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L46)

Whether the property is unmapped.

***

### isDistinct

> `readonly` **isDistinct**: `boolean`

Defined in: [core/src/schema/PropertyInfo.ts:48](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L48)

Whether the property is distinct.

***

### transform

> `readonly` **transform**: [`PropertyTransform`](../type-aliases/PropertyTransform.md)\<`unknown`\>

Defined in: [core/src/schema/PropertyInfo.ts:58](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L58)

A two-way transform between the application value and the stored value, or `null`.

A LIVE reference. Unlike `computed`, which is stringified into generated code, this is
held as-is so it can close over a key, a client, or anything else a caller needs — and
so it can be async, which generated code cannot be.

***

### indexes

> `readonly` **indexes**: `string`[]

Defined in: [core/src/schema/PropertyInfo.ts:60](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L60)

Indexes associated with the property.

***

### injected

> `readonly` **injected**: `any` = `null`

Defined in: [core/src/schema/PropertyInfo.ts:63](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L63)

Any injected value for the property.

***

### defaultValue

> `readonly` **defaultValue**: `any` = `null`

Defined in: [core/src/schema/PropertyInfo.ts:65](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L65)

The default value for the property, if any.

***

### valueSerializer

> `readonly` **valueSerializer**: [`PropertySerializer`](../type-aliases/PropertySerializer.md)\<`T`\> = `null`

Defined in: [core/src/schema/PropertyInfo.ts:67](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L67)

Serializer for the property value, if any.

***

### valueDeserializer

> `readonly` **valueDeserializer**: [`PropertyDeserializer`](../type-aliases/PropertyDeserializer.md)\<`T`\> = `null`

Defined in: [core/src/schema/PropertyInfo.ts:69](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L69)

Deserializer for the property value, if any.

***

### functionBody

> `readonly` **functionBody**: [`FunctionBody`](../type-aliases/FunctionBody.md)\<`any`, `T`\>

Defined in: [core/src/schema/PropertyInfo.ts:71](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L71)

Function body for computed properties, if any.

***

### children

> `readonly` **children**: `PropertyInfo`\<`T`\>[] = `[]`

Defined in: [core/src/schema/PropertyInfo.ts:73](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L73)

Child properties of this property.

***

### schema

> `readonly` **schema**: [`SchemaBase`](SchemaBase.md)\<`T`, `any`\>

Defined in: [core/src/schema/PropertyInfo.ts:75](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L75)

The schema this property belongs to.

***

### innerSchema?

> `readonly` `optional` **innerSchema**: [`SchemaBase`](SchemaBase.md)\<`unknown`, `any`\>

Defined in: [core/src/schema/PropertyInfo.ts:77](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L77)

The inner schema if this property is an array.

***

### dimensions

> `readonly` **dimensions**: `number`

Defined in: [core/src/schema/PropertyInfo.ts:79](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L79)

How many numbers this property holds if it is a vector, `null` otherwise.

***

### maxLength

> `readonly` **maxLength**: `number`

Defined in: [core/src/schema/PropertyInfo.ts:81](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L81)

The longest value this property is declared to hold, `null` if it declares none.

***

### isSearchable

> `readonly` **isSearchable**: `boolean`

Defined in: [core/src/schema/PropertyInfo.ts:88](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L88)

Whether this property may be tokenised into a full-text search index.

True only for a string. See the constructor — this is derived from the declaration and
the type together, not copied.

***

### literals

> `readonly` **literals**: `T`[]

Defined in: [core/src/schema/PropertyInfo.ts:90](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L90)

Literal values allowed for this property.

***

### tags

> `readonly` **tags**: `string`[]

Defined in: [core/src/schema/PropertyInfo.ts:92](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L92)

Tags passed from the schema

***

### parent?

> `readonly` `optional` **parent**: `PropertyInfo`\<`T`\>

Defined in: [core/src/schema/PropertyInfo.ts:95](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L95)

The parent property, if any.

## Accessors

### id

#### Get Signature

> **get** **id**(): `string`

Defined in: [core/src/schema/PropertyInfo.ts:18](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L18)

##### Returns

`string`

***

### level

#### Get Signature

> **get** **level**(): `number`

Defined in: [core/src/schema/PropertyInfo.ts:154](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L154)

Returns the depth (level) of this property in the property tree.

The root property has a level of 0. Each child property increases the level by 1.
Traverses up the parent chain, incrementing the level for each parent until the root is reached.

##### Returns

`number`

The number of parent properties above this property (0 for root).

***

### isRenamed

#### Get Signature

> **get** **isRenamed**(): `boolean`

Defined in: [core/src/schema/PropertyInfo.ts:177](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L177)

##### Returns

`boolean`

***

### supportsDeserialization

#### Get Signature

> **get** **supportsDeserialization**(): `boolean`

Defined in: [core/src/schema/PropertyInfo.ts:181](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L181)

##### Returns

`boolean`

***

### hasNullableParents

#### Get Signature

> **get** **hasNullableParents**(): `boolean`

Defined in: [core/src/schema/PropertyInfo.ts:308](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L308)

Returns true if any parent property is nullable or optional.

##### Returns

`boolean`

True if any parent is nullable or optional, false otherwise.

***

### hasRenamedSegments

#### Get Signature

> **get** **hasRenamedSegments**(): `boolean`

Defined in: [core/src/schema/PropertyInfo.ts:332](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L332)

Returns true if this property or any parent is renamed with from().
Storage paths for such properties differ from their in-memory paths.

##### Returns

`boolean`

True if any segment of the path is renamed, false otherwise.

***

### hasIdentityChildren

#### Get Signature

> **get** **hasIdentityChildren**(): `boolean`

Defined in: [core/src/schema/PropertyInfo.ts:356](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L356)

Returns true if any child property (recursively) is an identity property.

##### Returns

`boolean`

True if any child is an identity property, false otherwise.

## Methods

### getResolvedName()

> **getResolvedName**(): `string`

Defined in: [core/src/schema/PropertyInfo.ts:242](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L242)

#### Returns

`string`

***

### getPathArray()

> **getPathArray**(): `string`[]

Defined in: [core/src/schema/PropertyInfo.ts:251](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L251)

Returns an array of property names representing the path from the root to this property.

#### Returns

`string`[]

The property path as an array of names.

***

### getParentPathArray()

> **getParentPathArray**(`options?`): `string`[]

Defined in: [core/src/schema/PropertyInfo.ts:272](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L272)

Returns an array of property names representing the path from the root to the parent of this property.

#### Parameters

##### options?

###### useFromPropertyName?

`boolean`

#### Returns

`string`[]

The property path as an array of names, excluding this property.

***

### getValue()

> **getValue**(`instance`): `any`

Defined in: [core/src/schema/PropertyInfo.ts:376](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L376)

Gets the value of this property from the given instance, following the property path.

#### Parameters

##### instance

[`UnknownRecord`](../type-aliases/UnknownRecord.md)

The object instance to retrieve the value from.

#### Returns

`any`

The value of the property, or null if not found.

***

### setValue()

> **setValue**(`instance`, `value`): `void`

Defined in: [core/src/schema/PropertyInfo.ts:402](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L402)

Sets the value of this property on the given instance, creating intermediate objects as needed.

#### Parameters

##### instance

[`UnknownRecord`](../type-aliases/UnknownRecord.md)

The object instance to set the value on.

##### value

`unknown`

The value to set.

#### Returns

`void`

***

### getSelectrorPath()

> **getSelectrorPath**(`options`): `string`

Defined in: [core/src/schema/PropertyInfo.ts:437](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L437)

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

###### useRemappedName?

`boolean`

#### Returns

`string`

The selector path string (e.g., 'parent.prop1.prop2').

***

### getAssignmentPath()

> **getAssignmentPath**(`options?`): `string`

Defined in: [core/src/schema/PropertyInfo.ts:452](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L452)

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

Defined in: [core/src/schema/PropertyInfo.ts:466](https://github.com/Agrejus/routier/blob/main/core/src/schema/PropertyInfo.ts#L466)

#### Parameters

##### value

`string` | `number`

#### Returns

`string` \| `number` \| `boolean` \| `Date` \| `T`
