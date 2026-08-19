[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / toPredicate

# Function: toPredicate()

> **toPredicate**(`expression`): (`row`) => `boolean`

Defined in: [core/src/expressions/evaluate.ts:217](https://github.com/Agrejus/routier/blob/main/core/src/expressions/evaluate.ts#L217)

`evaluate`, as a predicate that keeps whatever it cannot judge.

The form every narrowing caller wants, with the fail-open rule applied once here rather than
remembered at each call site.

## Parameters

### expression

[`Expression`](../classes/Expression.md)

## Returns

> (`row`): `boolean`

### Parameters

#### row

[`UnknownRecord`](../type-aliases/UnknownRecord.md)

### Returns

`boolean`
