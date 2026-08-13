[**routier-collection**](/reference/api/README)

***

[routier-collection](/reference/api/README) / [core/src](/reference/api/core/src/README) / Expression

# Abstract Class: Expression

Defined in: [core/src/expressions/types.ts:13](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L13)

The base class for all expression types.

## Extended by

- [`EmptyExpression`](/reference/api/core/src/classes/EmptyExpression)
- [`NotParsableExpression`](/reference/api/core/src/classes/NotParsableExpression)
- [`ComparatorExpression`](/reference/api/core/src/classes/ComparatorExpression)
- [`OperatorExpression`](/reference/api/core/src/classes/OperatorExpression)
- [`PropertyExpression`](/reference/api/core/src/classes/PropertyExpression)
- [`ValueExpression`](/reference/api/core/src/classes/ValueExpression)

## Constructors

### Constructor

> **new Expression**(`left?`, `right?`): `Expression`

Defined in: [core/src/expressions/types.ts:21](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L21)

#### Parameters

##### left?

`Expression`

##### right?

`Expression`

#### Returns

`Expression`

## Properties

### type

> `abstract` `readonly` **type**: [`ExpressionType`](/reference/api/core/src/type-aliases/ExpressionType)

Defined in: [core/src/expressions/types.ts:15](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L15)

The type of the expression.

***

### left?

> `optional` **left**: `Expression`

Defined in: [core/src/expressions/types.ts:17](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L17)

The left-hand side of the expression (if applicable).

***

### right?

> `optional` **right**: `Expression`

Defined in: [core/src/expressions/types.ts:19](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L19)

The right-hand side of the expression (if applicable).

## Accessors

### EMPTY

#### Get Signature

> **get** `static` **EMPTY**(): [`EmptyExpression`](/reference/api/core/src/classes/EmptyExpression)

Defined in: [core/src/expressions/types.ts:26](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L26)

##### Returns

[`EmptyExpression`](/reference/api/core/src/classes/EmptyExpression)

***

### NOT\_PARSABLE

#### Get Signature

> **get** `static` **NOT\_PARSABLE**(): [`NotParsableExpression`](/reference/api/core/src/classes/NotParsableExpression)

Defined in: [core/src/expressions/types.ts:30](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L30)

##### Returns

[`NotParsableExpression`](/reference/api/core/src/classes/NotParsableExpression)

## Methods

### isEmpty()

> `static` **isEmpty**(`expression`): `boolean`

Defined in: [core/src/expressions/types.ts:34](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L34)

#### Parameters

##### expression

`Expression`

#### Returns

`boolean`

***

### isNotParsable()

> `static` **isNotParsable**(`expression`): `boolean`

Defined in: [core/src/expressions/types.ts:38](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L38)

#### Parameters

##### expression

`Expression`

#### Returns

`boolean`
