[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / describeFilters

# Function: describeFilters()

> **describeFilters**(`filters`, `row`): [`DescribedFilters`](../type-aliases/DescribedFilters.md)

Defined in: [core/src/plugins/query/describeFilter.ts:214](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/describeFilter.ts#L214)

Every filter on a query, as the body of one JavaScript predicate over `row`.

Filters accumulate, so `.where(a).where(b)` is `a && b`. Parameters run left to right across
the whole body, matching the text. A filter that could not be parsed is written as a call of
the caller's own function on `row`, and the reason goes in `notes`.

## Parameters

### filters

readonly `object`[]

### row

`string` = `"x"`

## Returns

[`DescribedFilters`](../type-aliases/DescribedFilters.md)
