# @routier/blob-plugin

<p align="center">
  <img src="https://routier.dev/routier.svg" alt="Routier" width="140" height="140" />
</p>

Files and media for Routier. **Metadata goes in your database, bytes go in blob storage.**

```ts
import { DataStore } from "@routier/datastore";
import { s } from "@routier/core/schema";
import { BlobDbPlugin, createFiles } from "@routier/blob-plugin";
import { fileSystemBlobStore } from "@routier/blob-plugin/stores/fileSystem";

const documentSchema = s.define("documents", {
  id: s.string().key().identity(),
  ownerId: s.string().index(),
  title: s.string(),
  file: s.file(),
}).compile();

const files = createFiles(fileSystemBlobStore("./uploads"));

class AppStore extends DataStore {
  documents = this.collection(documentSchema).proxy().create();
  constructor() { super(new BlobDbPlugin(new DexiePlugin("app"), files)); }
}

await store.documents.addAsync({ ownerId: user.id, title: "Q3 report", file: fileFromInput });
await store.saveChangesAsync();
```

`s.file()` accepts content — a `File`, `Blob`, `Uint8Array` or string — and stores a reference.
`BlobDbPlugin` performs that swap during the save and hands the reference to your real plugin,
which never learns that files exist.

Uploading explicitly is still available when you want the seam visible — `files.upload()`
returns a reference you can assign yourself, which is what the direct-upload flow does.

Reading back:

```ts
const doc = await store.documents.firstAsync(...);

doc.file.size          // 2_400_112
doc.file.contentType   // 'application/pdf'
doc.file.fileName      // 'q3.pdf'

await files.bytes(doc.file);   // Uint8Array
await files.url(doc.file);     // presigned GET, for stores that sign
```

## Why the split

A blob store is not a database. It has no query: filtering means listing a bucket and fetching
every object. So nothing you would filter, sort or count on ever goes there.

The row holds a **reference** — key, size, content type, checksum, name — and never the bytes.
A query over ten thousand documents is an ordinary indexed query that touches blob storage zero
times:

```ts
await store.documents
  .where(([d, p]) => d.ownerId === p.owner, { owner: user.id })
  .toArrayAsync();
```

Bytes are fetched only when you ask for them.

## Any database, any store

The two halves do not know about each other, so they compose freely. Metadata can live in
`dexie`, `sqlite`, `postgresql`, `mysql`, `memory` or the replication plugin. Bytes can live in
any `BlobStore`.

| Store | Where |
| --- | --- |
| `memoryBlobStore()` | tests and demos |
| `fileSystemBlobStore(root)` | Node — desktop apps, single-server deployments |
| `s3BlobStore({ bucket, client })` | AWS S3, Cloudflare R2, Google Cloud Storage |
| Azure Blob Storage | *not yet built* — it does not speak the S3 API |

`BlobStore` is five operations: `put`, `has`, `get`, `delete`, and optionally `url` and `list`.

### S3, R2 and GCS

One driver, three services. You construct the client, so the endpoint, region and credentials
are yours:

```ts
import { S3Client } from '@aws-sdk/client-s3';
import { s3BlobStore } from '@routier/blob-plugin/stores/s3';

// AWS
s3BlobStore({ bucket: 'uploads', client: new S3Client({ region: 'us-east-1' }) });

// Cloudflare R2
s3BlobStore({ bucket: 'uploads', client: new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
}) });
```

`@aws-sdk/client-s3` is an optional peer dependency, and `@aws-sdk/s3-request-presigner` is a
second one needed only by `url()`. Neither is downloaded by an application that does not use
this store.

`keyPrefix` puts several applications in one bucket and lets a lifecycle rule target this
plugin's objects and nothing else.

The driver hands S3 the SHA-256 already embedded in the content-addressed key, so the service
verifies each upload rather than trusting the transfer.

Verified against MinIO in a container — real HTTP, real 404 semantics, real pagination, and a
presigned URL fetched with no credentials. Run it with
`E2E_CONTAINERS=1 npx jest --selectProjects e2e`.

## Direct upload: the browser sends bytes to storage, not to you

Your API signs a URL; the browser PUTs to S3, R2 or GCS. A ten-gigabyte upload costs your
server one small JSON response, and the bytes never pass through it.

```ts
// --- your server, where the credentials are ---
app.post('/uploads', async (request, response) => {
  // Authorise here. Signing IS the authorisation decision.
  response.json(await files.createUploadUrl(request.body));
});

// --- the browser, which has none ---
const uploader = createDirectUploader({
  requestUpload: (descriptor) =>
    fetch('/uploads', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(descriptor),
    }).then(response => response.json()),
});

const reference = await uploader.upload(fileFromInput);

await store.documents.addAsync({ ownerId, title, file: reference });
await store.saveChangesAsync();
```

The browser hashes first, because a content-addressed key cannot be chosen until the content
is known. That ordering pays for itself: the server answers "already stored" for content it
already has, and **the browser then transfers nothing at all**.

### What makes it safe

The signature covers the content type and the SHA-256, not just the path. A client that omits
or alters either gets a 403 from the service.

That is not the default and it is not cosmetic. With the presigner's defaults only `host` is
signed, and dropping the checksum header from a signed PUT stored **completely different bytes
at a content-addressed key and returned 200** — verified against MinIO. The key would then lie
about its own content, and since identical content is deduplicated, the poisoned object would
be served to every record referencing that hash. Four tests hold that shut: mismatched bytes,
a dropped checksum header, a changed content type, and an expired URL.

Keep `expiresIn` short. A presigned URL is a bearer token for one object.

## Content addressing

A key is the SHA-256 of the bytes: `sha256/ab/abcdef…`. That buys three things.

- **Idempotent uploads.** The same content uploads once; a retry after a failed save cannot
  create a duplicate.
- **Dedup.** One file attached to a thousand records is stored once.
- **A key cannot lie**, because the key is derived from what it holds.

### The consequence you must know

**Two records can reference the same object, so removing a record never deletes its bytes.**
Nothing in this package deletes on remove. Storage is reclaimed only by an explicit sweep:

```ts
const live = (await store.documents.toArrayAsync()).map(d => d.file);
const { deleted } = await files.sweepOrphans(live);
```

The sweep takes the live set rather than discovering it, because getting that set wrong deletes
real data. A sweep with an empty set refuses to run — an empty set is almost always a failed
query, not an empty database. Pass `{ dryRun: true }` first.

## Contracts

### Durability

The store's. The filesystem store writes to a temporary name and renames, so a crash mid-write
cannot leave a short file at a content-addressed key.

### Atomicity

**A database and a blob store cannot be written atomically.** Blob stores have no transactions
and cannot enlist in one with SQLite or IndexedDB, so "both or neither" is not available.

What this package does instead: **upload first, then save.** If the save fails, the object is an
orphan — it costs storage and breaks nothing, and the sweep collects it. The other order leaves
a row pointing at bytes that were never written, which is a broken download in front of a user.

The row half is still atomic: your database plugin's transaction covers every row in the save.

### Concurrency

Content addressing is what makes concurrent uploads safe: two writers uploading the same bytes
write the same object, and two writers uploading different bytes write different keys. Nothing
locks.

### Schema migration

Not applicable. A reference is five plain fields.

### Failure semantics

- An upload that fails throws, and no row is written.
- A save that fails after an upload leaves an orphan. Sweep it.
- `url()` throws for a store that cannot sign, rather than returning one that will not work.
- `bytes()` on a missing key rejects.

## Limitations

- **Whole-file only.** Content is read into memory to be hashed and uploaded. Streaming and
  multipart uploads are not implemented, so this is not yet the tool for multi-gigabyte video.
- **No multipart.** A direct upload is a single PUT, which S3 caps at 5 GB.
- **Uploads are not part of the row transaction**, and cannot be. See *Atomicity*.

## Supported versions

Node 18 or later, and any modern browser. `crypto.subtle` is used for hashing and is standard
in both. `fileSystemBlobStore` is Node-only and lives at its own entry point so a browser bundle
never resolves `node:fs`.

## See also

- [S3 and SaaS Blob Storage guide](https://routier.dev/integrations/plugins/built-in-plugins/s3-blob-storage) — AWS S3, Cloudflare R2, Google Cloud Storage, MinIO, CORS, permissions, and direct uploads
- `@routier/dexie-plugin` — metadata in IndexedDB, the natural pairing for a web app
- `@routier/replication-plugin` — sync metadata to a server
