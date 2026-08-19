[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/blob/src](../README.md) / UploadRequest

# Type Alias: UploadRequest

> **UploadRequest** = `object`

Defined in: [plugins/blob/src/direct.ts:60](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/blob/src/direct.ts#L60)

What the browser tells the server about content it wants to upload.

## Properties

### checksum

> **checksum**: `string`

Defined in: [plugins/blob/src/direct.ts:62](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/blob/src/direct.ts#L62)

SHA-256 of the content, lowercase hex. Determines the key.

***

### size

> **size**: `number`

Defined in: [plugins/blob/src/direct.ts:64](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/blob/src/direct.ts#L64)

Byte length. Check it server-side before signing if you enforce a limit.

***

### contentType

> **contentType**: `string`

Defined in: [plugins/blob/src/direct.ts:66](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/blob/src/direct.ts#L66)

Media type. Signed into the URL, so the PUT must send exactly this.

***

### fileName

> **fileName**: `string`

Defined in: [plugins/blob/src/direct.ts:68](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/blob/src/direct.ts#L68)

Display name. Metadata only; it is not part of the key.
