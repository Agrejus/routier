[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/replication/src](../README.md) / SyncOutcome

# Interface: SyncOutcome

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:48](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/replication/src/HttpSwrDbPlugin.ts#L48)

What a flush moved. Returned by `syncNow()` and passed to `onSync`.

## Properties

### flushed

> **flushed**: `number`

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:50](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/replication/src/HttpSwrDbPlugin.ts#L50)

Changes the server accepted and the queue dropped.

***

### failed

> **failed**: `number`

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:52](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/replication/src/HttpSwrDbPlugin.ts#L52)

Changes that failed transiently and are still queued.

***

### deadLettered

> **deadLettered**: `number`

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:54](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/replication/src/HttpSwrDbPlugin.ts#L54)

Changes the server permanently rejected; reported via onSyncDeadLetter.
