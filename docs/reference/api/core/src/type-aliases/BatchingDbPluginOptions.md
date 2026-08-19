[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / BatchingDbPluginOptions

# Type Alias: BatchingDbPluginOptions

> **BatchingDbPluginOptions** = `object`

Defined in: [core/src/plugins/BatchingDbPlugin.ts:9](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/BatchingDbPlugin.ts#L9)

## Properties

### isAtomic?

> `optional` **isAtomic**: `boolean`

Defined in: [core/src/plugins/BatchingDbPlugin.ts:22](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/BatchingDbPlugin.ts#L22)

The caller PROMISING that a failed `bulkPersist` beneath this wrapper leaves NOTHING
applied. Only then may separate callers' saves be merged into one write, because the
failure path re-runs a failed batch item by item — and re-running a HALF-APPLIED batch
applies the landed items twice, which for adds means duplicate rows under fresh
identities, with nothing raised.

Omitted, the wrapper still queues and serializes; it just writes batches of one, which
is what happens without it in the stack at all. True of SQLite, PostgreSQL and MySQL —
one transaction, rolled back entire. Not true of anything that applies writes as it
goes without a way to undo them.

***

### maxBatchSize?

> `optional` **maxBatchSize**: `number`

Defined in: [core/src/plugins/BatchingDbPlugin.ts:33](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/BatchingDbPlugin.ts#L33)

The most writes one drain may take. Default 100.

A drain takes everything waiting, so a burst puts an unbounded statement set in one
transaction — and some engines cap that outright, D1's `batch()` in particular. Taking N
per pass changes none of the reasoning: the remainder is still waiting, the next drain
runs the moment this one returns, and a batch is still only what had already arrived.

It also bounds the failure fallback, which costs N+1 writes for a failing batch of N.
