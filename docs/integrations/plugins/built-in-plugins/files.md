---
title: Files and Blob Storage
---

# Files and Blob Storage

`@routier/blob-plugin` stores file metadata in your database and bytes in dedicated blob storage. It wraps any `IDbPlugin`; it is separate from `@routier/file-system-plugin`, which stores database rows as JSON files.

## Setup

```bash
npm install @routier/blob-plugin
```

```ts
import { BlobDbPlugin, createFiles } from "@routier/blob-plugin";
import { fileSystemBlobStore } from "@routier/blob-plugin/stores/fileSystem";

const documentSchema = s.define("documents", {
  id: s.string().key().identity(),
  title: s.string(),
  file: s.file(),
}).compile();

const files = createFiles(fileSystemBlobStore("./uploads"));
const plugin = new BlobDbPlugin(new SqliteDbPlugin("app.db"), files);
```

On create, `s.file()` accepts a `File`, `Blob`, `Uint8Array`, or string. The wrapper uploads the bytes during save and gives the database plugin a `FileReference` containing `key`, `size`, `contentType`, `checksum`, and `fileName`.

```ts
await store.documents.addAsync({ title: "Report", file: fileFromInput });
await store.saveChangesAsync();

const document = await store.documents.firstAsync();
const bytes = await files.bytes(document.file);
const url = await files.url(document.file); // if the store supports signed GET URLs
```

## Blob stores

| Store | Import | Use |
| --- | --- | --- |
| `memoryBlobStore()` | `@routier/blob-plugin` | Tests and demos |
| `fileSystemBlobStore(root)` | `@routier/blob-plugin/stores/fileSystem` | Node/local disk |
| `s3BlobStore({ bucket, client, ... })` | `@routier/blob-plugin/stores/s3` | AWS S3, Cloudflare R2, S3-compatible GCS, MinIO, and other S3 APIs |

S3 support uses optional `@aws-sdk/client-s3`; signed URLs additionally use `@aws-sdk/s3-request-presigner`.

::: tip Using a hosted object-storage provider?
See [S3 and SaaS Blob Storage](/integrations/plugins/built-in-plugins/s3-blob-storage) for complete AWS S3, Cloudflare R2, Google Cloud Storage, and MinIO configuration, plus bucket CORS, minimum permissions, signed downloads, and an end-to-end direct browser upload.
:::

Objects are content-addressed by SHA-256, so identical content deduplicates. Uploading bytes and committing database metadata cannot be one transaction: a failed database save can leave an orphaned object. Use lifecycle rules or reference reconciliation for cleanup.

## Direct browser uploads

`createDirectUploader({ requestUpload })` supports presigned direct upload: your API authorizes and signs, then the browser sends bytes directly to object storage. Keep signed URLs short-lived and sign both checksum and content type.

The [S3 and SaaS guide](/integrations/plugins/built-in-plugins/s3-blob-storage#direct-browser-upload) includes both halves of this flow, the required bucket CORS rule, and server-side validation.

## Related

- [S3 and SaaS Blob Storage](/integrations/plugins/built-in-plugins/s3-blob-storage)
- [Encryption](/integrations/plugins/built-in-plugins/encryption)
- [Attachments and Dirty Tracking](/guides/attachments)
- [Plugin Catalog](/integrations/plugins/built-in-plugins/)
- [Blob Plugin API](/reference/api/plugins/blob/src/README)
