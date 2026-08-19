[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/postgresql/src](../README.md) / PostgresPushdown

# Type Alias: PostgresPushdown

> **PostgresPushdown** = `SqlPushdown` & `object`

Defined in: [plugins/postgresql/src/PostgresSqlTranslator.ts:16](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/postgresql/src/PostgresSqlTranslator.ts#L16)

What Postgres can push down: everything the base class knows about, plus the vector ordering.

## Type Declaration

### nearest?

> `optional` **nearest**: `boolean`

The statement carried a `<=>` ordering and its `LIMIT`.
