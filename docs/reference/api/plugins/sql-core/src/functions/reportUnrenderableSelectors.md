[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sql-core/src](../README.md) / reportUnrenderableSelectors

# Function: reportUnrenderableSelectors()

> **reportUnrenderableSelectors**(`options`): `void`

Defined in: [plugins/sql-core/src/capability.ts:27](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/capability.ts#L27)

Hands back every sort, `nearest` and projection whose selector computes a value rather than naming a
property, for the datastore to run in memory.

A statement orders by a column and selects columns, and `r => r.name.length` is not one. Rendering the
property it reads orders by `name` instead, with no error, and the name the source text gives is not a
column at all. An aggregate reads the projection in front of it, so it goes back with it. A group is not
rendered, so its key is not checked here.

## Parameters

### options

`QueryOptionsCollection`\<`any`\>

## Returns

`void`
