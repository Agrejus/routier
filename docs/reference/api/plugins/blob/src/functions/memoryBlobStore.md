[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/blob/src](../README.md) / memoryBlobStore

# Function: memoryBlobStore()

> **memoryBlobStore**(): [`BlobStore`](../interfaces/BlobStore.md)

Defined in: [plugins/blob/src/stores/memory.ts:10](https://github.com/Agrejus/routier/blob/main/plugins/blob/src/stores/memory.ts#L10)

A blob store in a Map.

For tests and for demos. It is the store the plugin's own suite runs against, which is what
lets every behaviour here — content addressing, dedup, idempotent upload, orphan sweeping —
be tested with no cloud account and no container.

## Returns

[`BlobStore`](../interfaces/BlobStore.md)
