[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/replication/src](../README.md) / DeadLetteredChange

# Type Alias: DeadLetteredChange

> **DeadLetteredChange** = `object`

Defined in: [plugins/replication/src/UnsyncedQueue.ts:65](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/UnsyncedQueue.ts#L65)

A change the queue has given up on, reported via onSyncDeadLetter.

## Properties

### collectionName

> **collectionName**: `string`

Defined in: [plugins/replication/src/UnsyncedQueue.ts:66](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/UnsyncedQueue.ts#L66)

***

### kind

> **kind**: [`QueuedChangeKind`](QueuedChangeKind.md)

Defined in: [plugins/replication/src/UnsyncedQueue.ts:67](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/UnsyncedQueue.ts#L67)

***

### entity

> **entity**: `unknown`

Defined in: [plugins/replication/src/UnsyncedQueue.ts:68](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/UnsyncedQueue.ts#L68)

***

### opId

> **opId**: `string` \| `null`

Defined in: [plugins/replication/src/UnsyncedQueue.ts:69](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/UnsyncedQueue.ts#L69)
