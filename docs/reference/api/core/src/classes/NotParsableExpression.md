[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / NotParsableExpression

# Class: NotParsableExpression

Defined in: [core/src/expressions/types.ts:47](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L47)

The base class for all expression types.

## Extends

- [`Expression`](Expression.md)

## Constructors

### Constructor

> **new NotParsableExpression**(`left?`, `right?`): `NotParsableExpression`

Defined in: [core/src/expressions/types.ts:21](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L21)

#### Parameters

##### left?

[`Expression`](Expression.md)

##### right?

[`Expression`](Expression.md)

#### Returns

`NotParsableExpression`

#### Inherited from

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

> `readonly` **type**: `"not-parsable"`

Defined in: [core/src/expressions/types.ts:48](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L48)

The type of the expression.

#### Overrides

[`Expression`](Expression.md).[`type`](Expression.md#type)

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

> **get** `static` **NOT\_PARSABLE**(): `NotParsableExpression`

Defined in: [core/src/expressions/types.ts:30](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L30)

##### Returns

`NotParsableExpression`

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
