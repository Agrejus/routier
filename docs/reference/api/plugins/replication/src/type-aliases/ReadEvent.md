[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/replication/src](../README.md) / ReadEvent

# Type Alias: ReadEvent

> **ReadEvent** = \{ `type`: `"read"`; `ok`: `true`; `collectionName`: `string`; `status`: `number` \| `null`; \} \| \{ `type`: `"read"`; `ok`: `false`; `collectionName`: `string`; `status`: `number` \| `null`; `error`: `Error`; \}

Defined in: [plugins/replication/src/syncHooks.ts:5](https://github.com/Agrejus/routier/blob/main/plugins/replication/src/syncHooks.ts#L5)
