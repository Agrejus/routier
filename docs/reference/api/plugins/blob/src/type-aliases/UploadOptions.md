[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/blob/src](../README.md) / UploadOptions

# Type Alias: UploadOptions

> **UploadOptions** = `object`

Defined in: [plugins/blob/src/content.ts:16](https://github.com/Agrejus/routier/blob/main/plugins/blob/src/content.ts#L16)

## Properties

### contentType?

> `optional` **contentType**: `string`

Defined in: [plugins/blob/src/content.ts:23](https://github.com/Agrejus/routier/blob/main/plugins/blob/src/content.ts#L23)

Media type. Taken from a `Blob`/`File` when it has one.

Never sniffed from the bytes. A wrong content type served back to a browser is a
security question, not a convenience one, so it is the caller's to state.

***

### fileName?

> `optional` **fileName**: `string`

Defined in: [plugins/blob/src/content.ts:26](https://github.com/Agrejus/routier/blob/main/plugins/blob/src/content.ts#L26)

The name to show a user. Stored as metadata; it is not part of the key.
