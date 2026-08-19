[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/blob/src](../README.md) / createDirectUploader

# Function: createDirectUploader()

> **createDirectUploader**(`options`): `object`

Defined in: [plugins/blob/src/direct.ts:94](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/blob/src/direct.ts#L94)

The browser half. Holds no credentials and never talks to storage except to PUT.

## Parameters

### options

[`DirectUploaderOptions`](../type-aliases/DirectUploaderOptions.md)

## Returns

### upload()

> **upload**(`content`, `uploadOptions`): `Promise`\<`FileReferenceValue`\>

Hashes, asks for a grant, uploads if needed, and returns the reference.

Skips the transfer entirely when the server says the content is already stored.

#### Parameters

##### content

[`FileContent`](../type-aliases/FileContent.md)

##### uploadOptions

[`UploadOptions`](../type-aliases/UploadOptions.md) = `{}`

#### Returns

`Promise`\<`FileReferenceValue`\>
