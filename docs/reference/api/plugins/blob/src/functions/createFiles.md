[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/blob/src](../README.md) / createFiles

# Function: createFiles()

> **createFiles**(`store`): `object`

Defined in: [plugins/blob/src/files.ts:22](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/blob/src/files.ts#L22)

The file half of an application: upload, read back, and clean up.

Bound to one store, and deliberately knows nothing about your database. That separation is
the design — metadata is a row in whatever plugin you already use, bytes are an object in
blob storage — and keeping the two halves unaware of each other is what lets any database
pair with any store.

```ts
const files = createFiles(fileSystemBlobStore('./uploads'));

const reference = await files.upload(fileFromInput);
await store.documents.addAsync({ ownerId, title, file: reference });
await store.saveChangesAsync();
```

## Parameters

### store

[`BlobStore`](../interfaces/BlobStore.md)

## Returns

### store

> **store**: [`BlobStore`](../interfaces/BlobStore.md)

The store these files live in, for callers that need to reach it directly.

### upload()

> **upload**(`content`, `options`): `Promise`\<`FileReferenceValue`\>

Uploads content and returns the reference to store on a record.

Idempotent. The key is the SHA-256 of the bytes, so uploading the same content twice
writes one object and the second call skips the transfer entirely. A retry after a
failed save cannot produce a duplicate.

**Upload before the save, not after.** If the save then fails, the object is an orphan:
it costs storage and nothing else, and `sweepOrphans` collects it. The other order
leaves a row pointing at bytes that were never written, which is a broken download in
front of a user.

#### Parameters

##### content

[`FileContent`](../type-aliases/FileContent.md)

##### options

[`UploadOptions`](../type-aliases/UploadOptions.md) = `{}`

#### Returns

`Promise`\<`FileReferenceValue`\>

### createUploadUrl()

> **createUploadUrl**(`request`, `options`): `Promise`\<[`UploadGrant`](../type-aliases/UploadGrant.md)\>

Signs an upload so a client can send bytes straight to storage.

The server half of the direct-upload flow; `createDirectUploader` is the browser half.
Call it from an endpoint your users are authenticated against — a presigned URL is a
bearer token for one object, so signing is the authorisation decision.

Returns no URL at all when the content is already stored. Keys are content-addressed,
so "already stored" means the bytes are known to be identical, and the client uploads
nothing: re-attaching a file someone else uploaded transfers zero bytes.

The digest the client claims is signed into the request, so the service verifies the
body against it. A client cannot take a URL signed for one checksum and store different
bytes under a key that promises to be their hash.

Enforce your own limits before calling this — `request.size` and `request.contentType`
are the client's claims, and refusing to sign is how you reject an upload.

#### Parameters

##### request

[`UploadRequest`](../type-aliases/UploadRequest.md)

##### options

###### expiresIn?

`number`

#### Returns

`Promise`\<[`UploadGrant`](../type-aliases/UploadGrant.md)\>

### bytes()

> **bytes**(`reference`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Reads the bytes for a reference.

#### Parameters

##### reference

`FileReferenceValue`

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

### text()

> **text**(`reference`): `Promise`\<`string`\>

Reads the bytes and decodes them as UTF-8 text.

#### Parameters

##### reference

`FileReferenceValue`

#### Returns

`Promise`\<`string`\>

### url()

> **url**(`reference`, `options?`): `Promise`\<`string`\>

A URL a browser can fetch directly, when the store can issue one.

Throws for a store that cannot, rather than returning something that will not work.

#### Parameters

##### reference

`FileReferenceValue`

##### options?

###### expiresIn?

`number`

#### Returns

`Promise`\<`string`\>

### sweepOrphans()

> **sweepOrphans**(`live`, `options`): `Promise`\<\{ `deleted`: `string`[]; `kept`: `number`; \}\>

Deletes every object the given references do **not** cover.

This exists because keys are content-addressed, and that has a consequence worth being
blunt about: **two records can reference the same object**, so removing a record must
never delete its bytes. Nothing here deletes on remove. Storage is reclaimed only by
this sweep, run when you choose, against the full set of references your database
currently holds.

Get that set wrong and you delete live data. So it takes the references rather than
discovering them, the caller assembles them from a query they can reason about, and a
sweep with an empty set refuses to run — an empty set almost always means the query
failed, not that every file is garbage.

#### Parameters

##### live

`Iterable`\<`Pick`\<`FileReferenceValue`, `"key"`\>\>

##### options

###### allowEmpty?

`boolean`

###### dryRun?

`boolean`

#### Returns

`Promise`\<\{ `deleted`: `string`[]; `kept`: `number`; \}\>
