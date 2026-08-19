[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/postgresql/src](../README.md) / PostgresPushdown

# Type Alias: PostgresPushdown

> **PostgresPushdown** = `SqlPushdown` & `object`

Defined in: [plugins/postgresql/src/PostgresSqlTranslator.ts:16](https://github.com/Agrejus/routier/blob/main/plugins/postgresql/src/PostgresSqlTranslator.ts#L16)

What Postgres can push down: everything the base class knows about, plus the vector ordering.

## Type Declaration

### nearest?

> `optional` **nearest**: `boolean`

The statement carried a `<=>` ordering and its `LIMIT`.
