[**routier-collection**](../../../../../../README.md)

***

[routier-collection](../../../../../../README.md) / [plugins/blob/src/stores/fileSystem](../README.md) / fileSystemBlobStore

# Function: fileSystemBlobStore()

> **fileSystemBlobStore**(`root`): [`BlobStore`](../../../interfaces/BlobStore.md)

Defined in: [plugins/blob/src/stores/fileSystem.ts:17](https://github.com/Agrejus/routier/blob/main/plugins/blob/src/stores/fileSystem.ts#L17)

A blob store on the local filesystem.

Node only, and its own entry point so a browser bundle never resolves `node:fs`:

```ts
import { fileSystemBlobStore } from '@routier/blob-plugin/stores/fileSystem';
```

Useful for a desktop application, a single-server deployment, and for developing against
something real before pointing at S3. It is not a substitute for object storage across
several machines: nothing here coordinates two processes writing the same key, and
content-addressing is what makes that safe rather than any locking.

## Parameters

### root

`string`

## Returns

[`BlobStore`](../../../interfaces/BlobStore.md)
