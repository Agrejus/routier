[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / semiJoinFilter

# Function: semiJoinFilter()

> **semiJoinFilter**(`reference`, `keys`): `object`

Defined in: [core/src/plugins/query/join.ts:291](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/query/join.ts#L291)

A filter restricting the inner side to rows whose key is one the outer side actually has.

Built as an expression tree by hand rather than parsed from generated source, for the reason
`softDeleteScope` gives: generating source needs `new Function`, which a Content-Security-Policy
blocks, and the shape is known here so there is nothing to parse. An `includes` comparator over
an array value is what every translator already turns into `IN (...)` or `$in`, so this pushes
down on the backends that can take it and runs as the closure on the ones that cannot.

Cost only. Every pair it removes from the inner read is one the hash join would have discarded.

## Parameters

### reference

[`JoinKeyReference`](../type-aliases/JoinKeyReference.md)

### keys

`ReadonlySet`\<`unknown`\>

## Returns

`object`

### params?

> `optional` **params**: `object`

### filter

> **filter**: [`ParamsFilter`](../type-aliases/ParamsFilter.md)\<`any`, \{ \}\> \| [`Filter`](../type-aliases/Filter.md)\<`any`\>

### expression

> **expression**: [`Expression`](../classes/Expression.md)
