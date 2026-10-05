[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/replication/src](../README.md) / PluginSyncEngineOptions

# Type Alias: PluginSyncEngineOptions

> **PluginSyncEngineOptions** = `object`

Defined in: [plugins/replication/src/PluginSyncEngine.ts:32](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/PluginSyncEngine.ts#L32)

## Properties

### source

> **source**: `IDbPlugin`

Defined in: [plugins/replication/src/PluginSyncEngine.ts:34](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/PluginSyncEngine.ts#L34)

Primary read/write plugin.

***

### queryPlugins?

> `optional` **queryPlugins**: `IDbPlugin`[]

Defined in: [plugins/replication/src/PluginSyncEngine.ts:40](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/PluginSyncEngine.ts#L40)

Optional ordered list of plugins to try for reads.
If omitted, reads use source.

#### Default

```ts
[source]
```

***

### mirrorPlugins?

> `optional` **mirrorPlugins**: `IDbPlugin`[]

Defined in: [plugins/replication/src/PluginSyncEngine.ts:46](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/PluginSyncEngine.ts#L46)

Plugins that should receive mirrored writes after source succeeds.
Typical use: write-through from local store to remote sync plugin.

#### Default

```ts
[]
```

***

### persistAckMode?

> `optional` **persistAckMode**: [`PersistAckMode`](PersistAckMode.md)

Defined in: [plugins/replication/src/PluginSyncEngine.ts:53](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/PluginSyncEngine.ts#L53)

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

Defined in: [plugins/replication/src/PluginSyncEngine.ts:60](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/PluginSyncEngine.ts#L60)

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

Defined in: [plugins/replication/src/PluginSyncEngine.ts:65](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/PluginSyncEngine.ts#L65)

When all query routes fail, choose which error to surface.

#### Default

```ts
"surface-last"
```

***

### destroyFailureMode?

> `optional` **destroyFailureMode**: [`DestroyFailureMode`](DestroyFailureMode.md)

Defined in: [plugins/replication/src/PluginSyncEngine.ts:70](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/PluginSyncEngine.ts#L70)

Destroy error policy across composed plugins.

#### Default

```ts
"surface-last"
```

***

### onMirrorError()?

> `optional` **onMirrorError**: (`error`, `context`) => `void`

Defined in: [plugins/replication/src/PluginSyncEngine.ts:75](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/PluginSyncEngine.ts#L75)

Optional hook for swallowed mirror failures (after-source or swallow mode).

#### Parameters

##### error

`Error`

##### context

[`MirrorErrorContext`](MirrorErrorContext.md)

#### Returns

`void`

#### Default

```ts
undefined
```

***

### mirrorPersistPayloadMode?

> `optional` **mirrorPersistPayloadMode**: [`MirrorPersistPayloadMode`](MirrorPersistPayloadMode.md)

Defined in: [plugins/replication/src/PluginSyncEngine.ts:83](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/PluginSyncEngine.ts#L83)

Strategy for payload sent to mirror plugins during bulkPersist.
- original-event: mirrors receive the same operation payload.
- resolve-from-source-result: mirror payload is rebuilt with resolveBulkPersistChanges(...),
  useful when source generated ids must be mirrored downstream.

#### Default

```ts
"original-event"
```

***

### etagOwner?

> `optional` **etagOwner**: `EtagOwner`

Defined in: [plugins/replication/src/PluginSyncEngine.ts:84](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/PluginSyncEngine.ts#L84)

***

### onMirrorPersisted()?

> `optional` **onMirrorPersisted**: (`event`, `result`) => `void`

Defined in: [plugins/replication/src/PluginSyncEngine.ts:85](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/PluginSyncEngine.ts#L85)

#### Parameters

##### event

`DbPluginBulkPersistEvent`

##### result

`BulkPersistResult`

#### Returns

`void`

***

### pluginCallTimeoutMs?

> `optional` **pluginCallTimeoutMs**: `number`

Defined in: [plugins/replication/src/PluginSyncEngine.ts:92](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/PluginSyncEngine.ts#L92)

Max time (ms) to wait for a composed plugin to call done() before treating the call
as failed. Guards the engine against a plugin that never completes — otherwise one
hung plugin stalls every operation routed through it forever. 0 disables.

#### Default

```ts
60_000
```
