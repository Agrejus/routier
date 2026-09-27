[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / describeFilters

# Function: describeFilters()

> **describeFilters**(`filters`): [`ParameterisedQuery`](../type-aliases/ParameterisedQuery.md)

Defined in: [core/src/plugins/query/describeFilter.ts:213](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/describeFilter.ts#L213)

Every filter on a query, as one description.

Filters accumulate — `.where(a).where(b)` is `a && b` — so they are reported as one predicate
rather than several, which is how the caller thinks of them and how a SQL plugin renders them
into one `WHERE`. Parameters run left to right across the whole thing, matching the text.

A filter that could not be parsed falls back to its source. Mixing the two is deliberate: one
unparsable filter does not make the others unreadable, and seeing which one it was is the
point.

## Parameters

### filters

readonly `object`[]

## Returns

[`ParameterisedQuery`](../type-aliases/ParameterisedQuery.md)
