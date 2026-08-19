[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/replication/src](../README.md) / PluginSyncEngineOptions

# Type Alias: PluginSyncEngineOptions

> **PluginSyncEngineOptions** = `object`

Defined in: [plugins/replication/src/PluginSyncEngine.ts:26](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/replication/src/PluginSyncEngine.ts#L26)

## Properties

### source

> **source**: `IDbPlugin`

Defined in: [plugins/replication/src/PluginSyncEngine.ts:28](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/replication/src/PluginSyncEngine.ts#L28)

Primary read/write plugin.

***

### queryPlugins?

> `optional` **queryPlugins**: `IDbPlugin`[]

Defined in: [plugins/replication/src/PluginSyncEngine.ts:34](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/replication/src/PluginSyncEngine.ts#L34)

Optional ordered list of plugins to try for reads.
If omitted, reads use source.

#### Default

```ts
[source]
```

***

### mirrorPlugins?

> `optional` **mirrorPlugins**: `IDbPlugin`[]

Defined in: [plugins/replication/src/PluginSyncEngine.ts:40](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/replication/src/PluginSyncEngine.ts#L40)

Plugins that should receive mirrored writes after source succeeds.
Typical use: write-through from local store to remote sync plugin.

#### Default

```ts
[]
```

***

### persistAckMode?

> `optional` **persistAckMode**: [`PersistAckMode`](PersistAckMode.md)

Defined in: [plugins/replication/src/PluginSyncEngine.ts:47](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/replication/src/PluginSyncEngine.ts#L47)

Whether to report success to caller after source only, or after all mirrors settle.
- after-source: low-latency optimistic ack.
- after-all: transactional-style ack across composition.

#### Default

```ts
"after-source"
```

***

### mirrorFailureMode?

> `optional` **mirrorFailureMode**: [`MirrorFailureMode`](MirrorFailureMode.md)

Defined in: [plugins/replication/src/PluginSyncEngine.ts:54](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/replication/src/PluginSyncEngine.ts#L54)

How mirror failures are handled.
- swallow: keep success from source and emit hook/log.
- surface: fail operation (only meaningful with ackMode=after-all).

#### Default

```ts
"swallow"
```

***

### queryFailureMode?

> `optional` **queryFailureMode**: [`QueryFailureMode`](QueryFailureMode.md)

Defined in: [plugins/replication/src/PluginSyncEngine.ts:59](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/replication/src/PluginSyncEngine.ts#L59)

When all query routes fail, choose which error to surface.

#### Default

```ts
"surface-last"
```

***

### destroyFailureMode?

> `optional` **destroyFailureMode**: [`DestroyFailureMode`](DestroyFailureMode.md)

Defined in: [plugins/replication/src/PluginSyncEngine.ts:64](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/replication/src/PluginSyncEngine.ts#L64)

Destroy error policy across composed plugins.

#### Default

```ts
"surface-last"
```

***

### onMirrorError()?

> `optional` **onMirrorError**: (`error`, `context`) => `void`

Defined in: [plugins/replication/src/PluginSyncEngine.ts:69](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/replication/src/PluginSyncEngine.ts#L69)

Optional hook for swallowed mirror failures (after-source or swallow mode).

#### Parameters

##### error

`Error`

##### context

###### pluginIndex

`number`

###### eventId

`string`

#### Returns

`void`

#### Default

```ts
undefined
```

***

### mirrorPersistPayloadMode?

> `optional` **mirrorPersistPayloadMode**: [`MirrorPersistPayloadMode`](MirrorPersistPayloadMode.md)

Defined in: [plugins/replication/src/PluginSyncEngine.ts:77](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/replication/src/PluginSyncEngine.ts#L77)

Strategy for payload sent to mirror plugins during bulkPersist.
- original-event: mirrors receive the same operation payload.
- resolve-from-source-result: mirror payload is rebuilt with resolveBulkPersistChanges(...),
  useful when source generated ids must be mirrored downstream.

#### Default

```ts
"original-event"
```

***

### pluginCallTimeoutMs?

> `optional` **pluginCallTimeoutMs**: `number`

Defined in: [plugins/replication/src/PluginSyncEngine.ts:84](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/replication/src/PluginSyncEngine.ts#L84)

Max time (ms) to wait for a composed plugin to call done() before treating the call
as failed. Guards the engine against a plugin that never completes — otherwise one
hung plugin stalls every operation routed through it forever. 0 disables.

#### Default

```ts
60_000
```
