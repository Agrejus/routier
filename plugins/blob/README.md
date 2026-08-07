# @routier/blob-plugin

Files and media for Routier. **Metadata goes in your database, bytes go in blob storage.**

```ts
import { DataStore } from "@routier/datastore";
import { s } from "@routier/core/schema";
import { createFiles, fileRef } from "@routier/blob-plugin";
import { fileSystemBlobStore } from "@routier/blob-plugin/stores/fileSystem";

const documentSchema = s.define("documents", {
  id: s.string().key().identity(),
  ownerId: s.string().index(),
  title: s.string(),
  file: fileRef(),
}).compile();

const files = createFiles(fileSystemBlobStore("./uploads"));

const reference = await files.upload(fileFromInput);

await store.documents.addAsync({ ownerId: user.id, title: "Q3 report", file: reference });
await store.saveChangesAsync();
```

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
| S3, R2, GCS, Azure | *not yet built* — the same five-method interface |

`BlobStore` is five operations: `put`, `has`, `get`, `delete`, and optionally `url` and `list`.
R2 and GCS both speak the S3 API, so one driver covers three of them.

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
- **No presigned browser uploads yet.** Direct browser-to-S3 upload is the design goal and is
  what the `url` hook exists for; it is not built.
- **`file: someFile` does not work.** You upload explicitly and store what you get back. A
  schema's generated `preprocess` runs before any plugin sees an entity and keeps only what the
  schema declares, so raw content assigned to a property does not arrive mangled — it does not
  arrive at all. Making that work needs `s.file()` to be a real schema primitive in core.

## Supported versions

Node 18 or later, and any modern browser. `crypto.subtle` is used for hashing and is standard
in both. `fileSystemBlobStore` is Node-only and lives at its own entry point so a browser bundle
never resolves `node:fs`.

## See also

- `@routier/dexie-plugin` — metadata in IndexedDB, the natural pairing for a web app
- `@routier/replication-plugin` — sync metadata to a server
