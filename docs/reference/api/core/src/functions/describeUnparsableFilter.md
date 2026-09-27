[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / describeUnparsableFilter

# Function: describeUnparsableFilter()

> **describeUnparsableFilter**(`filter`, `reason?`): [`ParameterisedQuery`](../type-aliases/ParameterisedQuery.md)

Defined in: [core/src/plugins/query/describeFilter.ts:242](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/describeFilter.ts#L242)

A predicate core could not parse, shown as the caller wrote it.

This is the case where the source matters most: an unparsable filter is why the query did not
push down, and the reason codes say that it happened without showing what it was. There are no
parameters — nothing was extracted, because nothing was understood.

## Parameters

### filter

`unknown`

### reason?

`string`

## Returns

[`ParameterisedQuery`](../type-aliases/ParameterisedQuery.md)
