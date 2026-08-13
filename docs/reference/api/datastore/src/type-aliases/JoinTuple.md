[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [datastore/src](../README.md) / JoinTuple

# Type Alias: JoinTuple\<TOuter, TInner\>

> **JoinTuple**\<`TOuter`, `TInner`\> = \[`TOuter`, `TInner`\]

Defined in: [datastore/src/queryable/JoinQueryable.ts:27](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/JoinQueryable.ts#L27)

A query over JOINED TUPLES.

A typed API surface and nothing more: every method records an option into the same
`QueryOptionsCollection` an unjoined query uses, and execution goes through the same path.
There is no separate join executor.

**What is missing is missing on purpose.** `sum`/`min`/`max`/`distinct`, `toGroup`,
`subscribe` and `remove` are absent from this type rather than throwing at runtime:

 - the aggregates need one mapped numeric field, which a tuple is not — project with `.map()`
   first and they are available on the projection;
 - a join subscription would have to listen to BOTH schemas and re-run, and
   `DataBridge.subscribe` is single-schema;
 - a tuple is not a row, so there is nothing to remove.

`Shape` is the tuple — `[outer, inner]`, or `[outer, inner | undefined]` after `leftJoin` —
until `.map()` replaces it with a projection.

## Type Parameters

### TOuter

`TOuter`

### TInner

`TInner`
