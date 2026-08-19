[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / OperatorExpression

# Class: OperatorExpression

Defined in: [core/src/expressions/types.ts:299](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/expressions/types.ts#L299)

A class representing a logical operator (e.g., &&, ||).

## Extends

- [`Expression`](Expression.md)

## Constructors

### Constructor

> **new OperatorExpression**(`options`): `OperatorExpression`

Defined in: [core/src/expressions/types.ts:305](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/expressions/types.ts#L305)

#### Parameters

##### options

###### operator

[`Operator`](../type-aliases/Operator.md)

###### left?

[`Expression`](Expression.md)

###### right?

[`Expression`](Expression.md)

#### Returns

`OperatorExpression`

#### Overrides

[`Expression`](Expression.md).[`constructor`](Expression.md#constructor)

## Properties

### left?

> `optional` **left**: [`Expression`](Expression.md)

Defined in: [core/src/expressions/types.ts:100](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/expressions/types.ts#L100)

The left-hand side of the expression (if applicable).

#### Inherited from

[`Expression`](Expression.md).[`left`](Expression.md#left)

***

### right?

> `optional` **right**: [`Expression`](Expression.md)

Defined in: [core/src/expressions/types.ts:102](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/expressions/types.ts#L102)

The right-hand side of the expression (if applicable).

#### Inherited from

[`Expression`](Expression.md).[`right`](Expression.md#right)

***

### type

> `readonly` **type**: `"operator"`

Defined in: [core/src/expressions/types.ts:301](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/expressions/types.ts#L301)

The type of the expression (always 'operator').

#### Overrides

[`Expression`](Expression.md).[`type`](Expression.md#type)

***

### operator

> **operator**: [`Operator`](../type-aliases/Operator.md)

Defined in: [core/src/expressions/types.ts:303](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/expressions/types.ts#L303)

The logical operator.

## Accessors

### EMPTY

#### Get Signature

> **get** `static` **EMPTY**(): [`EmptyExpression`](EmptyExpression.md)

Defined in: [core/src/expressions/types.ts:109](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/expressions/types.ts#L109)

##### Returns

[`EmptyExpression`](EmptyExpression.md)

#### Inherited from

[`Expression`](Expression.md).[`EMPTY`](Expression.md#empty)

***

### NOT\_PARSABLE

#### Get Signature

> **get** `static` **NOT\_PARSABLE**(): [`NotParsableExpression`](NotParsableExpression.md)

Defined in: [core/src/expressions/types.ts:113](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/expressions/types.ts#L113)

##### Returns

[`NotParsableExpression`](NotParsableExpression.md)

#### Inherited from

[`Expression`](Expression.md).[`NOT_PARSABLE`](Expression.md#not_parsable)

## Methods

### isEmpty()

> `static` **isEmpty**(`expression`): `boolean`

Defined in: [core/src/expressions/types.ts:117](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/expressions/types.ts#L117)

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

Defined in: [core/src/expressions/types.ts:121](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/expressions/types.ts#L121)

#### Parameters

##### expression

[`Expression`](Expression.md)

#### Returns

`boolean`

#### Inherited from

[`Expression`](Expression.md).[`isNotParsable`](Expression.md#isnotparsable)

***

### toJson()

> `static` **toJson**(`expression`): [`SerializedExpression`](../type-aliases/SerializedExpression.md)

Defined in: [core/src/expressions/types.ts:147](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/expressions/types.ts#L147)

Turns a tree into plain JSON, so a whole query can cross a wire.

On the class rather than beside it, because this is the type's own REPRESENTATION — there is one
right answer and it belongs with the thing being represented, next to `EMPTY` and `isEmpty`.
Rendering a tree into some other language (`toSql`, `toMql`, `evaluate`) is a different kind of
thing: there are many, each belongs to its consumer, and none of them is canonical.

## Why it is this small

Of the six node types a bound tree can contain, exactly one holds anything JSON cannot carry:
`PropertyExpression`, whose live `PropertyInfo` has functions, a parent chain and caches. It
reduces to a property PATH — `PropertyInfo.id` IS the dotted path, and `getProperty` is keyed by
exactly that — so rebinding is one lookup.

`ParamReferenceExpression` never appears: it is a parse-time placeholder that binding replaces
with a plain `ValueExpression` holding the resolved value. A serialized tree is always already
bound, so there is no params object to send alongside it.

Switches on `type` rather than using the `isXExpression` guards, which live in `../assertions`
and import this module — the guards test the same discriminant, so nothing is lost.

#### Parameters

##### expression

[`Expression`](Expression.md)

#### Returns

[`SerializedExpression`](../type-aliases/SerializedExpression.md)

#### Inherited from

[`Expression`](Expression.md).[`toJson`](Expression.md#tojson)

***

### fromJson()

> `static` **fromJson**(`json`, `schema`): [`Expression`](Expression.md)

Defined in: [core/src/expressions/types.ts:211](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/expressions/types.ts#L211)

Rebuilds a tree from JSON, rebinding every property against `schema`.

The schema is SUPPLIED rather than read out of the payload. A filter always belongs to a known
collection, and the RECEIVER's schema is the authority on what its properties are — taking an
id from the payload would mean rebinding against a schema the sender chose, which is backwards
for anything crossing a trust boundary.

#### Parameters

##### json

[`SerializedExpression`](../type-aliases/SerializedExpression.md)

##### schema

[`CompiledSchemaCore`](../type-aliases/CompiledSchemaCore.md)\<`any`\>

#### Returns

[`Expression`](Expression.md)

#### Throws

when a property path is not declared by `schema`. Not `NOT_PARSABLE`: on a receiver, a
filter that silently stops filtering returns rows the requester excluded, which is the one
failure here worse than an error.

#### Inherited from

[`Expression`](Expression.md).[`fromJson`](Expression.md#fromjson)
