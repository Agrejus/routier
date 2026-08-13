[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / Expression

# Abstract Class: Expression

Defined in: [core/src/expressions/types.ts:96](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/expressions/types.ts#L96)

The base class for all expression types.

## Extended by

- [`EmptyExpression`](EmptyExpression.md)
- [`NotParsableExpression`](NotParsableExpression.md)
- [`ComparatorExpression`](ComparatorExpression.md)
- [`OperatorExpression`](OperatorExpression.md)
- [`PropertyExpression`](PropertyExpression.md)
- [`ValueExpression`](ValueExpression.md)

## Constructors

### Constructor

> **new Expression**(`left?`, `right?`): `Expression`

Defined in: [core/src/expressions/types.ts:104](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/expressions/types.ts#L104)

#### Parameters

##### left?

`Expression`

##### right?

`Expression`

#### Returns

`Expression`

## Properties

### type

> `abstract` `readonly` **type**: [`ExpressionType`](../type-aliases/ExpressionType.md)

Defined in: [core/src/expressions/types.ts:98](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/expressions/types.ts#L98)

The type of the expression.

***

### left?

> `optional` **left**: `Expression`

Defined in: [core/src/expressions/types.ts:100](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/expressions/types.ts#L100)

The left-hand side of the expression (if applicable).

***

### right?

> `optional` **right**: `Expression`

Defined in: [core/src/expressions/types.ts:102](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/expressions/types.ts#L102)

The right-hand side of the expression (if applicable).

## Accessors

### EMPTY

#### Get Signature

> **get** `static` **EMPTY**(): [`EmptyExpression`](EmptyExpression.md)

Defined in: [core/src/expressions/types.ts:109](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/expressions/types.ts#L109)

##### Returns

[`EmptyExpression`](EmptyExpression.md)

***

### NOT\_PARSABLE

#### Get Signature

> **get** `static` **NOT\_PARSABLE**(): [`NotParsableExpression`](NotParsableExpression.md)

Defined in: [core/src/expressions/types.ts:113](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/expressions/types.ts#L113)

##### Returns

[`NotParsableExpression`](NotParsableExpression.md)

## Methods

### isEmpty()

> `static` **isEmpty**(`expression`): `boolean`

Defined in: [core/src/expressions/types.ts:117](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/expressions/types.ts#L117)

#### Parameters

##### expression

`Expression`

#### Returns

`boolean`

***

### isNotParsable()

> `static` **isNotParsable**(`expression`): `boolean`

Defined in: [core/src/expressions/types.ts:121](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/expressions/types.ts#L121)

#### Parameters

##### expression

`Expression`

#### Returns

`boolean`

***

### toJson()

> `static` **toJson**(`expression`): [`SerializedExpression`](../type-aliases/SerializedExpression.md)

Defined in: [core/src/expressions/types.ts:147](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/expressions/types.ts#L147)

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

`Expression`

#### Returns

[`SerializedExpression`](../type-aliases/SerializedExpression.md)

***

### fromJson()

> `static` **fromJson**(`json`, `schema`): `Expression`

Defined in: [core/src/expressions/types.ts:211](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/expressions/types.ts#L211)

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

`Expression`

#### Throws

when a property path is not declared by `schema`. Not `NOT_PARSABLE`: on a receiver, a
filter that silently stops filtering returns rows the requester excluded, which is the one
failure here worse than an error.
