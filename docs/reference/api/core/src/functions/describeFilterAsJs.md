[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / describeFilterAsJs

# Function: describeFilterAsJs()

> **describeFilterAsJs**(`expression`): [`ParameterisedQuery`](../type-aliases/ParameterisedQuery.md)

Defined in: [core/src/plugins/query/describeFilter.ts:64](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/describeFilter.ts#L64)

The predicate as JavaScript, with every value replaced by `?`.

Rendered from the parsed tree rather than from the function's source. The tree is what the
backend was actually given, so this cannot drift from what ran; and a value reaching the tree
as a literal is indistinguishable from one arriving through a params object, which is what
makes both come out as `?` the way SQL treats them.

## Parameters

### expression

[`Expression`](../classes/Expression.md)

## Returns

[`ParameterisedQuery`](../type-aliases/ParameterisedQuery.md)
