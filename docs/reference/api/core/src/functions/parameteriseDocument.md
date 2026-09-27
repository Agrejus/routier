[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / parameteriseDocument

# Function: parameteriseDocument()

> **parameteriseDocument**(`document`): [`ParameterisedQuery`](../type-aliases/ParameterisedQuery.md)

Defined in: [core/src/plugins/query/describeFilter.ts:175](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/describeFilter.ts#L175)

Renders a query DOCUMENT with its values replaced by `?`.

Language-agnostic on purpose: an MQL filter and a Mango selector are both plain objects, and so
is whatever a future document store wants reported. The dialect decides the shape; this only
decides how it is written down.

A value not wrapped by `parameter` is structural — an operator name, a field path, a nesting
level — and is printed as it is. That is the whole distinction, and it has to be made where the
document is built, because by the time it is an object the two are the same kind of thing.

## Parameters

### document

`unknown`

## Returns

[`ParameterisedQuery`](../type-aliases/ParameterisedQuery.md)
