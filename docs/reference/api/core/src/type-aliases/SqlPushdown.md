[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / SqlPushdown

# Type Alias: SqlPushdown

> **SqlPushdown** = `object`

Defined in: [core/src/plugins/translators/SqlTranslator.ts:43](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/SqlTranslator.ts#L43)

What the statement that produced these rows actually did.

Supplied by the plugin because only its query builder knows: an extension may be missing, a
window may have made a pushdown unsafe, an inner filter may have had no column to compare
against. Every flag defaults to false — the safe direction, since doing the work twice is slow
and skipping it is wrong.

## Properties

### join?

> `optional` **join**: `boolean`

Defined in: [core/src/plugins/translators/SqlTranslator.ts:45](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/SqlTranslator.ts#L45)

The statement contained a real `INNER JOIN`/`LEFT JOIN` and its rows are already tuples.
