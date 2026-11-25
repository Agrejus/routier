[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/replication/src](../README.md) / ConflictResolvedEvent

# Type Alias: ConflictResolvedEvent

> **ConflictResolvedEvent** = `object`

Defined in: [plugins/replication/src/syncHooks.ts:24](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/syncHooks.ts#L24)

A conflict resolver settled a change the server refused: `merged` queued a new version,
`server` took the server's row, and `deferred` left the change queued.

## Properties

### type

> **type**: `"conflict-resolved"`

Defined in: [plugins/replication/src/syncHooks.ts:24](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/syncHooks.ts#L24)

***

### collectionName

> **collectionName**: `string`

Defined in: [plugins/replication/src/syncHooks.ts:24](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/syncHooks.ts#L24)

***

### outcome

> **outcome**: `"merged"` \| `"server"` \| `"deferred"`

Defined in: [plugins/replication/src/syncHooks.ts:24](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/syncHooks.ts#L24)
