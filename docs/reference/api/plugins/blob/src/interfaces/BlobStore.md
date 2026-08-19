[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/blob/src](../README.md) / BlobStore

# Interface: BlobStore

Defined in: [plugins/blob/src/stores/types.ts:25](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/blob/src/stores/types.ts#L25)

## Properties

### name

> `readonly` **name**: `string`

Defined in: [plugins/blob/src/stores/types.ts:27](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/blob/src/stores/types.ts#L27)

Names the store, so an error says which one failed.

## Methods

### put()

> **put**(`key`, `bytes`, `options`): `Promise`\<`void`\>

Defined in: [plugins/blob/src/stores/types.ts:35](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/blob/src/stores/types.ts#L35)

Writes bytes at `key`.

Must be idempotent: keys are content-addressed, so writing the same key twice writes
identical bytes, and a retried upload has to be harmless rather than a duplicate.

#### Parameters

##### key

`string`

##### bytes

`Uint8Array`

##### options

###### contentType

`string`

#### Returns

`Promise`\<`void`\>

***

### has()

> **has**(`key`): `Promise`\<`boolean`\>

Defined in: [plugins/blob/src/stores/types.ts:38](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/blob/src/stores/types.ts#L38)

Whether `key` already holds bytes. Lets an upload skip work it has already done.

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`boolean`\>

***

### get()

> **get**(`key`): `Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

Defined in: [plugins/blob/src/stores/types.ts:41](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/blob/src/stores/types.ts#L41)

Reads the bytes back. Rejects when the key is absent.

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`Uint8Array`\<`ArrayBufferLike`\>\>

***

### delete()

> **delete**(`key`): `Promise`\<`void`\>

Defined in: [plugins/blob/src/stores/types.ts:44](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/blob/src/stores/types.ts#L44)

Removes the object. Succeeds when it is already gone.

#### Parameters

##### key

`string`

#### Returns

`Promise`\<`void`\>

***

### url()?

> `optional` **url**(`key`, `options?`): `Promise`\<`string`\>

Defined in: [plugins/blob/src/stores/types.ts:53](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/blob/src/stores/types.ts#L53)

A URL a browser can fetch directly, if the store can issue one.

Optional because not every store can. The filesystem store cannot, and says so rather
than pretending. For S3 and its compatibles this is a presigned GET, which is what lets
a browser download bytes without proxying them through your server.

#### Parameters

##### key

`string`

##### options?

###### expiresIn?

`number`

#### Returns

`Promise`\<`string`\>

***

### list()?

> `optional` **list**(`prefix`): `AsyncIterable`\<`string`\>

Defined in: [plugins/blob/src/stores/types.ts:61](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/blob/src/stores/types.ts#L61)

Every key under `prefix`.

Only for sweeping orphans, which is the one job that legitimately needs to enumerate a
bucket. Never call it on a read path.

#### Parameters

##### prefix

`string`

#### Returns

`AsyncIterable`\<`string`\>

***

### uploadUrl()?

> `optional` **uploadUrl**(`key`, `options`): `Promise`\<[`PresignedUpload`](../type-aliases/PresignedUpload.md)\>

Defined in: [plugins/blob/src/stores/types.ts:75](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/blob/src/stores/types.ts#L75)

A URL a client can PUT bytes to directly, if the store can issue one.

This is what lets a browser upload to S3 without the bytes passing through your server:
the server signs, the browser transfers. A ten-gigabyte upload costs your API one small
JSON response.

Returns the headers the client MUST send with the PUT. A presigned URL signs the
headers as well as the path, so a client that omits or changes one gets a 403 — that is
the mechanism that stops a signed URL for a small text file being reused to upload
something else.

#### Parameters

##### key

`string`

##### options

[`UploadUrlOptions`](../type-aliases/UploadUrlOptions.md)

#### Returns

`Promise`\<[`PresignedUpload`](../type-aliases/PresignedUpload.md)\>
