[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sql-core/src](../README.md) / KeyTuple

# Type Alias: KeyTuple

> **KeyTuple** = `Record`\<`string`, `unknown`\>

Defined in: [plugins/sql-core/src/updates.ts:41](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sql-core/src/updates.ts#L41)

The full identity of one row: every identity column mapped to its value.

Every WHERE this module emits is built from all of these, never just the first.
A predicate on one component of a composite key matches every row that shares
that component, so a partial-key UPDATE does not merely miss its target — it
overwrites its siblings.
