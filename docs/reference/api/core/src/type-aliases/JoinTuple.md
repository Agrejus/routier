[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / JoinTuple

# Type Alias: JoinTuple

> **JoinTuple** = \[[`UnknownRecord`](UnknownRecord.md), [`UnknownRecord`](UnknownRecord.md) \| `undefined`\]

Defined in: [core/src/plugins/query/join.ts:58](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/join.ts#L58)

A joined pair, each half fully deserialized into its own schema's ENTITY shape.

The wire contract for every interpretation of a join: a native SQL join, an in-plugin hash
join, and the datastore's cross-plugin join all produce exactly this. Flat combined rows
never leave a translator — see `specs/joins.md`.
