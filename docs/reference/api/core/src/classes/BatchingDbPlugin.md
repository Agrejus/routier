[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / BatchingDbPlugin

# Class: BatchingDbPlugin

Defined in: [core/src/plugins/BatchingDbPlugin.ts:88](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/BatchingDbPlugin.ts#L88)

Coalesces overlapping writes into single round trips.

## Why

One logical change produces more than one write: the caller's `saveChanges`, then every view
reconciling in response to it. A store with three views issues four writes, none coordinated
with the others. On a local file that is invisible; against a server the round trip dominates
everything else a save does.

## The shape, and why it cannot cost anything

A write arrives and joins the queue. If one is already in flight, the running drain will take
it. Otherwise drain immediately: take everything waiting up to `maxBatchSize` and write it,
then drain again for whatever arrived meanwhile and whatever the ceiling left behind.

Nothing polls, nothing sleeps, nothing waits for a batch to fill. **A batch is only what had
already arrived**, so when writes do not overlap the queue is empty, the batch is one item,
and the write is byte for byte what happens without this wrapper. Latency cannot increase;
throughput improves exactly when there is contention to improve.

## What may be merged

Only items whose schemas do not overlap, and only with `isAtomic`. Two writes to one
collection are genuinely ordered — a plugin applies removes, then updates, then adds WITHIN a
schema, so merging an add of a row with a later update of it would run the update first,
against a row that does not exist yet, and lose it silently. Items sharing a schema therefore
go in separate writes, in arrival order.

That same rule is what lets a merged result be split back by SCHEMA rather than by position:
each schema in a merged write came from exactly one item, so no assumption about the order a
plugin echoes rows in is needed anywhere.

## See

specs/write-batching.md

## Implements

- [`IDbPlugin`](../interfaces/IDbPlugin.md)

## Constructors

### Constructor

> **new BatchingDbPlugin**(`plugin`, `options`): `BatchingDbPlugin`

Defined in: [core/src/plugins/BatchingDbPlugin.ts:100](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/BatchingDbPlugin.ts#L100)

#### Parameters

##### plugin

[`IDbPlugin`](../interfaces/IDbPlugin.md)

##### options

[`BatchingDbPluginOptions`](../type-aliases/BatchingDbPluginOptions.md) = `{}`

#### Returns

`BatchingDbPlugin`

## Accessors

### databaseName

#### Get Signature

> **get** **databaseName**(): `string`

Defined in: [core/src/plugins/BatchingDbPlugin.ts:107](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/BatchingDbPlugin.ts#L107)

Uniquely identifies the database this plugin talks to, INCLUDING host or path where a
bare name would collide — `orders.db` in two directories is two databases, and `mydb`
on two hosts is two databases. Two instances over the same database must return the
same string, in this process and in any other; two over different databases must not.

Used to scope schema subscription channels, so instances of one database (another tab,
a worker) see each other's change notifications and unrelated databases holding the
same schema do not.

Required rather than optional on purpose. An absent value used to fall back to scoping
by schema alone, which shares one channel across every database holding that schema —
the exact cross-talk this prevents, arrived at by omission. Requiring it also makes a
wrapper that forgets to forward it a compile error rather than a silent regression.

Derive it, never generate it: a random value is unique per PROCESS, not per database,
so another tab would never match one and cross-context notifications would stop.

Must not contain credentials — it becomes part of a channel key, so build it from
host/port/database rather than returning a connection string.

##### Returns

`string`

Uniquely identifies the database this plugin talks to, INCLUDING host or path where a
bare name would collide — `orders.db` in two directories is two databases, and `mydb`
on two hosts is two databases. Two instances over the same database must return the
same string, in this process and in any other; two over different databases must not.

Used to scope schema subscription channels, so instances of one database (another tab,
a worker) see each other's change notifications and unrelated databases holding the
same schema do not.

Required rather than optional on purpose. An absent value used to fall back to scoping
by schema alone, which shares one channel across every database holding that schema —
the exact cross-talk this prevents, arrived at by omission. Requiring it also makes a
wrapper that forgets to forward it a compile error rather than a silent regression.

Derive it, never generate it: a random value is unique per PROCESS, not per database,
so another tab would never match one and cross-context notifications would stop.

Must not contain credentials — it becomes part of a channel key, so build it from
host/port/database rather than returning a connection string.

#### Implementation of

[`IDbPlugin`](../interfaces/IDbPlugin.md).[`databaseName`](../interfaces/IDbPlugin.md#databasename)

## Methods

### query()

> **query**\<`TRoot`, `TShape`\>(`event`, `done`): `void`

Defined in: [core/src/plugins/BatchingDbPlugin.ts:112](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/BatchingDbPlugin.ts#L112)

Reads are not batched: they have no lock to contend for and no ordering to preserve.

#### Type Parameters

##### TRoot

`TRoot` *extends* `object`

##### TShape

`TShape` *extends* `unknown` = `TRoot`

#### Parameters

##### event

[`DbPluginQueryEvent`](../type-aliases/DbPluginQueryEvent.md)\<`TRoot`, `TShape`\>

##### done

[`PluginEventCallbackResult`](../type-aliases/PluginEventCallbackResult.md)\<[`ITranslatedValue`](../interfaces/ITranslatedValue.md)\<`TShape`\>\>

#### Returns

`void`

#### Implementation of

[`IDbPlugin`](../interfaces/IDbPlugin.md).[`query`](../interfaces/IDbPlugin.md#query)

***

### bulkPersist()

> **bulkPersist**(`event`, `done`): `void`

Defined in: [core/src/plugins/BatchingDbPlugin.ts:119](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/BatchingDbPlugin.ts#L119)

Executes bulk operations (add, update, remove) on the database.

#### Parameters

##### event

[`DbPluginBulkPersistEvent`](../type-aliases/DbPluginBulkPersistEvent.md)

The bulk operations event containing schema, parent, and changes.

##### done

[`PluginEventCallbackPartialResult`](../type-aliases/PluginEventCallbackPartialResult.md)\<[`BulkPersistResult`](BulkPersistResult.md)\>

Callback with the result or error.

#### Returns

`void`

#### Implementation of

[`IDbPlugin`](../interfaces/IDbPlugin.md).[`bulkPersist`](../interfaces/IDbPlugin.md#bulkpersist)

***

### destroy()

> **destroy**(`event`, `done`): `void`

Defined in: [core/src/plugins/BatchingDbPlugin.ts:156](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/plugins/BatchingDbPlugin.ts#L156)

Destroys the inner plugin, answering everything this wrapper is holding first.

`destroy` is destructive rather than graceful — the SQLite plugin deletes the database —
so draining first would spend round trips producing state the next call destroys, and
the drain loop refills, making teardown unbounded. Queued items are therefore failed
rather than flushed.

An in-flight write is a different matter: it has already been sent, destroying cannot
un-send it, and its callers are owed the real result. So the inner `destroy` waits for it
to settle — dropping a `deleteDatabase` on top of an open transaction is its own failure.

#### Parameters

##### event

[`DbPluginEvent`](../type-aliases/DbPluginEvent.md)

##### done

[`PluginEventCallbackResult`](../type-aliases/PluginEventCallbackResult.md)\<`never`\>

#### Returns

`void`

#### Implementation of

[`IDbPlugin`](../interfaces/IDbPlugin.md).[`destroy`](../interfaces/IDbPlugin.md#destroy)
