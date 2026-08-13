[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / cosineDistance

# Function: cosineDistance()

> **cosineDistance**(`left`, `right`): `number`

Defined in: [core/src/plugins/query/similarity.ts:28](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/query/similarity.ts#L28)

Distance in `[0, 2]`, or `Infinity` for a value that cannot be compared.

`Infinity` covers three cases, and they all sort LAST, which is what PostgreSQL does too:
a missing value (`NULL` sorts last under `ASC` by default), a zero-magnitude vector
(pgvector's `<=>` yields `NaN`, which PostgreSQL orders after every real number), and a
stored vector of the wrong width.

The width case cannot happen on a native `vector(n)` column — the engine rejects the write —
so it only arises on a backend storing JSON, where the data was written by something other
than this schema. Sorting it last rather than throwing keeps one corrupt row from failing a
query that is otherwise answerable.

## Parameters

### left

readonly `number`[]

### right

readonly `number`[]

## Returns

`number`
