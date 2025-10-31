[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / PropertyExpression

# Class: PropertyExpression

Defined in: [core/src/expressions/types.ts:98](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L98)

A class representing a property path.

## Extends

- [`Expression`](Expression.md)

## Constructors

### Constructor

> **new PropertyExpression**(`options`): `PropertyExpression`

Defined in: [core/src/expressions/types.ts:106](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L106)

#### Parameters

##### options

###### property

[`PropertyInfo`](PropertyInfo.md)\<`any`\>

#### Returns

`PropertyExpression`

#### Overrides

[`Expression`](Expression.md).[`constructor`](Expression.md#constructor)

## Properties

### left?

> `optional` **left**: [`Expression`](Expression.md)

Defined in: [core/src/expressions/types.ts:17](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L17)

The left-hand side of the expression (if applicable).

#### Inherited from

[`Expression`](Expression.md).[`left`](Expression.md#left)

***

### right?

> `optional` **right**: [`Expression`](Expression.md)

Defined in: [core/src/expressions/types.ts:19](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L19)

The right-hand side of the expression (if applicable).

#### Inherited from

[`Expression`](Expression.md).[`right`](Expression.md#right)

***

### type

> `readonly` **type**: `"property"`

Defined in: [core/src/expressions/types.ts:100](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L100)

The type of the expression (always 'property').

#### Overrides

[`Expression`](Expression.md).[`type`](Expression.md#type)

***

### property

> **property**: [`PropertyInfo`](PropertyInfo.md)\<`any`\>

Defined in: [core/src/expressions/types.ts:102](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L102)

The property info for the path.

***

### transformer

> **transformer**: [`Transformer`](../type-aliases/Transformer.md) = `null`

Defined in: [core/src/expressions/types.ts:103](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L103)

***

### locale

> **locale**: `string` = `null`

Defined in: [core/src/expressions/types.ts:104](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L104)

## Accessors

### EMPTY

#### Get Signature

> **get** `static` **EMPTY**(): [`EmptyExpression`](EmptyExpression.md)

Defined in: [core/src/expressions/types.ts:26](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L26)

##### Returns

[`EmptyExpression`](EmptyExpression.md)

#### Inherited from

[`Expression`](Expression.md).[`EMPTY`](Expression.md#empty)

***

### NOT\_PARSABLE

#### Get Signature

> **get** `static` **NOT\_PARSABLE**(): [`NotParsableExpression`](NotParsableExpression.md)

Defined in: [core/src/expressions/types.ts:30](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L30)

##### Returns

[`NotParsableExpression`](NotParsableExpression.md)

#### Inherited from

[`Expression`](Expression.md).[`NOT_PARSABLE`](Expression.md#not_parsable)

## Methods

### isEmpty()

> `static` **isEmpty**(`expression`): `boolean`

Defined in: [core/src/expressions/types.ts:34](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L34)

#### Parameters

##### expression

[`Expression`](Expression.md)

#### Returns

`boolean`

#### Inherited from

[`Expression`](Expression.md).[`isEmpty`](Expression.md#isempty)

***

### isNotParsable()

> `static` **isNotParsable**(`expression`): `boolean`

Defined in: [core/src/expressions/types.ts:38](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L38)

#### Parameters

##### expression

[`Expression`](Expression.md)

#### Returns

`boolean`

#### Inherited from

[`Expression`](Expression.md).[`isNotParsable`](Expression.md#isnotparsable)
