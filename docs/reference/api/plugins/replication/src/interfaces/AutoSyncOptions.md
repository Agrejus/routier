[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/replication/src](../README.md) / AutoSyncOptions

# Interface: AutoSyncOptions

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:46](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpSwrDbPlugin.ts#L46)

When the plugin syncs on its own.

Automatic is the default and needs no configuration: unsynced changes retry on a backing-off
timer, and immediately when the browser regains connectivity. Every field here is an override
for an app that wants a different cadence — or none at all, driving `syncNow()` itself.

## Properties

### delayMs?

> `optional` **delayMs**: `number`

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:47](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpSwrDbPlugin.ts#L47)

***

### maxDelayMs?

> `optional` **maxDelayMs**: `number`

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:49](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpSwrDbPlugin.ts#L49)

Ceiling for the backing-off delay. Default 60_000.

***

### syncWhenOnline?

> `optional` **syncWhenOnline**: `boolean`

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:54](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpSwrDbPlugin.ts#L54)

Flush the moment the platform reports connectivity is back, instead of waiting out the
current delay. Default true; ignored where there is no `online` event to listen for.

***

### minIntervalMs?

> `optional` **minIntervalMs**: `number`

Defined in: [plugins/replication/src/HttpSwrDbPlugin.ts:64](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/HttpSwrDbPlugin.ts#L64)

Minimum gap between the *starts* of two flushes. Default 250; 0 disables the wait
(flushes still never overlap). Not applied when `autoSync` is `false` — see below.

Guards against the app talking to itself too fast: a double-clicked "Sync now", a
connection that flaps, or a manual flush landing on top of a background one. Triggers
inside the window coalesce into a single follow-up flush rather than each becoming a
round of requests.
