[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / toStrictPredicate

# Function: toStrictPredicate()

> **toStrictPredicate**(`expression`): (`row`) => `boolean`

Defined in: [core/src/expressions/evaluate.ts:230](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/expressions/evaluate.ts#L230)

`evaluate`, as a predicate that THROWS on anything it cannot judge.

The opposite default to `toPredicate`, and the right one when the predicate is the only thing
standing between a caller and rows they asked to exclude — a filter that arrived over a wire and
is being applied by the receiver. Failing open there does not cost a wasted comparison; it returns
data the requester filtered out, and reports nothing.

Use `toPredicate` when something authoritative re-checks the result, and this when nothing does.

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
