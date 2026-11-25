[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/replication/src](../README.md) / SyncHooks

# Interface: SyncHooks\<TError\>

Defined in: [plugins/replication/src/syncHooks.ts:64](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/syncHooks.ts#L64)

## Extended by

- [`HttpPluginOptions`](HttpPluginOptions.md)
- [`HttpSwrDbPluginOptions`](HttpSwrDbPluginOptions.md)

## Type Parameters

### TError

`TError`

## Properties

### onEvent()?

> `optional` **onEvent**: (`event`) => `void`

Defined in: [plugins/replication/src/syncHooks.ts:65](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/syncHooks.ts#L65)

#### Parameters

##### event

[`SyncEvent`](../type-aliases/SyncEvent.md)

#### Returns

`void`

***

### onError()?

> `optional` **onError**: (`error`) => `void`

Defined in: [plugins/replication/src/syncHooks.ts:66](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/syncHooks.ts#L66)

#### Parameters

##### error

`TError`

#### Returns

`void`
