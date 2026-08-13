[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / CacheDbPluginOptions

# Type Alias: CacheDbPluginOptions

> **CacheDbPluginOptions** = `object`

Defined in: [core/src/plugins/CacheDbPlugin.ts:34](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/CacheDbPlugin.ts#L34)

A read-through LRU in front of a slower plugin.

## What it can and cannot promise

Invalidation is the whole problem with a cache, and this one solves exactly one version of
it: **writes that go through this wrapper**. A save invalidates every cached read for the
schemas it touched, so a store that reads and writes through the same instance never sees
its own stale data.

It cannot see anything else. A write by another process, another tab, or another store over
the same database leaves this cache holding rows that no longer exist, until they age out.
That is not a defect to fix later — a cache in front of a plugin has no way to learn about a
change it did not make — it is the condition for using this at all. Put it in front of data
that is slow to fetch and tolerant of being briefly wrong, and nowhere else.

Invalidation is per SCHEMA rather than per row, deliberately. Deciding whether a changed row
would have matched a cached filter means evaluating every cached query against it, which is
the work the cache exists to avoid, and getting it wrong keeps a stale row visible. Dropping
a schema's entries is cheap and cannot be subtly wrong.

```ts
const store = new MyStore(new CacheDbPlugin(new SomeDbPlugin(...), { max: 100 }));
```

## Properties

### max?

> `optional` **max**: `number`

Defined in: [core/src/plugins/CacheDbPlugin.ts:36](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/CacheDbPlugin.ts#L36)

How many query results to keep. Default 100; the least recently used is evicted.
