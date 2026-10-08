[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/replication/src](../README.md) / ChangesRejectedEvent

# Type Alias: ChangesRejectedEvent

> **ChangesRejectedEvent** = `object`

Defined in: [plugins/replication/src/syncHooks.ts:9](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/syncHooks.ts#L9)

## Properties

### type

> **type**: `"changes-rejected"`

Defined in: [plugins/replication/src/syncHooks.ts:10](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/syncHooks.ts#L10)

***

### collectionName

> **collectionName**: `string`

Defined in: [plugins/replication/src/syncHooks.ts:11](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/syncHooks.ts#L11)

***

### changes

> **changes**: [`RejectedChange`](RejectedChange.md)[]

Defined in: [plugins/replication/src/syncHooks.ts:12](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/syncHooks.ts#L12)

***

### conflict

> **conflict**: `boolean`

Defined in: [plugins/replication/src/syncHooks.ts:13](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/syncHooks.ts#L13)

***

### status

> **status**: `number` \| `null`

Defined in: [plugins/replication/src/syncHooks.ts:14](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/syncHooks.ts#L14)

***

### error

> **error**: `Error`

Defined in: [plugins/replication/src/syncHooks.ts:15](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/syncHooks.ts#L15)
