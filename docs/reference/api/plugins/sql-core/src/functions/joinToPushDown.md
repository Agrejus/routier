[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sql-core/src](../README.md) / joinToPushDown

# Function: joinToPushDown()

> **joinToPushDown**(`options`, `dialect`): `QueryOption`\<`any`, `"join"`\>

Defined in: [plugins/sql-core/src/capability.ts:70](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/capability.ts#L70)

The join to push down, or `null`. Reports first: a JOIN over an unfiltered outer side pairs the wrong rows.

The first thing every SQL plugin's query does, so it is also where a `group` over a renamed property
is handed back. No statement renders a group: `JsonTranslator` groups the rows in JavaScript, by
in-memory names, and a row read from a table is keyed by its columns.

## Parameters

### options

`QueryOptionsCollection`\<`any`\>

### dialect

[`SqlDialectName`](../type-aliases/SqlDialectName.md)

## Returns

`QueryOption`\<`any`, `"join"`\>
