[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/replication/src](../README.md) / ChangesRejectedEvent

# Type Alias: ChangesRejectedEvent

> **ChangesRejectedEvent** = `object`

Defined in: plugins/replication/src/syncHooks.ts:9

## Properties

### type

> **type**: `"changes-rejected"`

Defined in: plugins/replication/src/syncHooks.ts:10

***

### collectionName

> **collectionName**: `string`

Defined in: plugins/replication/src/syncHooks.ts:11

***

### changes

> **changes**: [`RejectedChange`](RejectedChange.md)[]

Defined in: plugins/replication/src/syncHooks.ts:12

***

### conflict

> **conflict**: `boolean`

Defined in: plugins/replication/src/syncHooks.ts:13

***

### status

> **status**: `number` \| `null`

Defined in: plugins/replication/src/syncHooks.ts:14

***

### error

> **error**: `Error`

Defined in: plugins/replication/src/syncHooks.ts:15
