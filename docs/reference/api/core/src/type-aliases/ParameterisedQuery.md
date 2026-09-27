[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / ParameterisedQuery

# Type Alias: ParameterisedQuery

> **ParameterisedQuery** = `object`

Defined in: [core/src/plugins/query/describeFilter.ts:31](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/describeFilter.ts#L31)

Saying what a backend was asked to do, with the values pulled out.

`explain` already carries `{ text, parameters }` per executed query, and the SQL plugins fill
both in — a statement with `?` and the values bound to it. Every other backend reported a
placeholder: Dexie said `filter(<predicate>)`, which names nothing, and a key-value store said
only that it scanned. The predicate was the one thing a reader wanted and the one thing missing.

Two renderings live here, and neither knows about a specific engine:

- `describeFilterAsJs` — the predicate as JavaScript, for a backend with no query language of
  its own. It reads like what the caller wrote, which is what they are looking for.
- `parameteriseDocument` — for a backend whose query IS a document. Values become `?` and are
  collected in order, so a Mango selector and an MQL filter both come out in their own shape
  with the values listed beside them.

Pulling values out is not decoration. It is what makes two runs of one query comparable, and
what keeps a value out of the text when that text is logged.

## Properties

### text

> **text**: `string`

Defined in: [core/src/plugins/query/describeFilter.ts:33](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/describeFilter.ts#L33)

The query in its own language, with each value replaced by `?`.

***

### parameters

> **parameters**: `unknown`[]

Defined in: [core/src/plugins/query/describeFilter.ts:35](https://github.com/Agrejus/routier/blob/main/core/src/plugins/query/describeFilter.ts#L35)

The values, in the order their placeholders appear.
