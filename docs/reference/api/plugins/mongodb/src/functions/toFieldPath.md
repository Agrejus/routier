[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/mongodb/src](../README.md) / toFieldPath

# Function: toFieldPath()

> **toFieldPath**(`prop`): `string`

Defined in: [plugins/mongodb/src/mql.ts:123](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/mongodb/src/mql.ts#L123)

Storage-side dotted path for a property.

Each segment resolves through `from`, so a renamed nested property addresses the name
that is actually stored rather than the name the schema exposes. Mongo reads
`a.b.c` natively, which is why nested filtering works here and not in the SQL plugins.

## Parameters

### prop

`PropertyExpression`

## Returns

`string`
