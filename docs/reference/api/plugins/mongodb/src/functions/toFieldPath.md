[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/mongodb/src](../README.md) / toFieldPath

# Function: toFieldPath()

> **toFieldPath**(`prop`): `string`

Defined in: [plugins/mongodb/src/mql.ts:123](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/mongodb/src/mql.ts#L123)

Storage-side dotted path for a property.

Each segment resolves through `from`, so a renamed nested property addresses the name
that is actually stored rather than the name the schema exposes. Mongo reads
`a.b.c` natively, which is why nested filtering works here and not in the SQL plugins.

## Parameters

### prop

`PropertyExpression`

## Returns

`string`
