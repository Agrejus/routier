[**routier-collection**](/reference/api/README)

***

[routier-collection](/reference/api/README) / [core/src](/reference/api/core/src/README) / ValueExpression

# Class: ValueExpression

Defined in: [core/src/expressions/types.ts:115](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L115)

A class representing a literal value.

## Extends

- [`Expression`](/reference/api/core/src/classes/Expression)

## Constructors

### Constructor

> **new ValueExpression**(`options`): `ValueExpression`

Defined in: [core/src/expressions/types.ts:124](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L124)

#### Parameters

##### options

###### value

`unknown`

#### Returns

`ValueExpression`

#### Overrides

[`Expression`](/reference/api/core/src/classes/Expression).[`constructor`](/reference/api/core/src/classes/Expression#constructor)

## Properties

### left?

> `optional` **left**: [`Expression`](/reference/api/core/src/classes/Expression)

Defined in: [core/src/expressions/types.ts:17](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L17)

The left-hand side of the expression (if applicable).

#### Inherited from

[`Expression`](/reference/api/core/src/classes/Expression).[`left`](/reference/api/core/src/classes/Expression#left)

***

### right?

> `optional` **right**: [`Expression`](/reference/api/core/src/classes/Expression)

Defined in: [core/src/expressions/types.ts:19](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L19)

The right-hand side of the expression (if applicable).

#### Inherited from

[`Expression`](/reference/api/core/src/classes/Expression).[`right`](/reference/api/core/src/classes/Expression#right)

***

### type

> `readonly` **type**: `"value"`

Defined in: [core/src/expressions/types.ts:117](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L117)

The type of the expression (always 'value').

#### Overrides

[`Expression`](/reference/api/core/src/classes/Expression).[`type`](/reference/api/core/src/classes/Expression#type)

***

### value

> **value**: `unknown`

Defined in: [core/src/expressions/types.ts:119](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L119)

The literal value.

***

### transformer

> **transformer**: [`Transformer`](/reference/api/core/src/type-aliases/Transformer) = `null`

Defined in: [core/src/expressions/types.ts:121](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L121)

***

### locale

> **locale**: `string` = `null`

Defined in: [core/src/expressions/types.ts:122](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L122)

## Accessors

### EMPTY

#### Get Signature

> **get** `static` **EMPTY**(): [`EmptyExpression`](/reference/api/core/src/classes/EmptyExpression)

Defined in: [core/src/expressions/types.ts:26](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L26)

##### Returns

[`EmptyExpression`](/reference/api/core/src/classes/EmptyExpression)

#### Inherited from

[`Expression`](/reference/api/core/src/classes/Expression).[`EMPTY`](/reference/api/core/src/classes/Expression#empty)

***

### NOT\_PARSABLE

#### Get Signature

> **get** `static` **NOT\_PARSABLE**(): [`NotParsableExpression`](/reference/api/core/src/classes/NotParsableExpression)

Defined in: [core/src/expressions/types.ts:30](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L30)

##### Returns

[`NotParsableExpression`](/reference/api/core/src/classes/NotParsableExpression)

#### Inherited from

[`Expression`](/reference/api/core/src/classes/Expression).[`NOT_PARSABLE`](/reference/api/core/src/classes/Expression#not_parsable)

## Methods

### isEmpty()

> `static` **isEmpty**(`expression`): `boolean`

Defined in: [core/src/expressions/types.ts:34](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L34)

#### Parameters

##### expression

[`Expression`](/reference/api/core/src/classes/Expression)

#### Returns

`boolean`

#### Inherited from

[`Expression`](/reference/api/core/src/classes/Expression).[`isEmpty`](/reference/api/core/src/classes/Expression#isempty)

***

### isNotParsable()

> `static` **isNotParsable**(`expression`): `boolean`

Defined in: [core/src/expressions/types.ts:38](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/expressions/types.ts#L38)

#### Parameters

##### expression

[`Expression`](/reference/api/core/src/classes/Expression)

#### Returns

`boolean`

#### Inherited from

[`Expression`](/reference/api/core/src/classes/Expression).[`isNotParsable`](/reference/api/core/src/classes/Expression#isnotparsable)
