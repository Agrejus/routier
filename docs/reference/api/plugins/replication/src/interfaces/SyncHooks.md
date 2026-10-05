[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/replication/src](../README.md) / SyncHooks

# Interface: SyncHooks\<TError\>

Defined in: plugins/replication/src/syncHooks.ts:58

## Extended by

- [`HttpPluginOptions`](HttpPluginOptions.md)
- [`HttpSwrDbPluginOptions`](HttpSwrDbPluginOptions.md)

## Type Parameters

### TError

`TError`

## Properties

### onEvent()?

> `optional` **onEvent**: (`event`) => `void`

Defined in: plugins/replication/src/syncHooks.ts:59

#### Parameters

##### event

[`SyncEvent`](../type-aliases/SyncEvent.md)

#### Returns

`void`

***

### onError()?

> `optional` **onError**: (`error`) => `void`

Defined in: plugins/replication/src/syncHooks.ts:60

#### Parameters

##### error

`TError`

#### Returns

`void`
