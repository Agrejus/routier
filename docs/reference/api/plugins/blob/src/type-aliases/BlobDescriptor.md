[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/blob/src](../README.md) / BlobDescriptor

# Type Alias: BlobDescriptor

> **BlobDescriptor** = `object`

Defined in: [plugins/blob/src/stores/types.ts:14](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/blob/src/stores/types.ts#L14)

What a stored object looks like once it is in the store.

## Properties

### key

> **key**: `string`

Defined in: [plugins/blob/src/stores/types.ts:16](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/blob/src/stores/types.ts#L16)

Where the bytes live. Content-addressed: `sha256/<checksum>`.

***

### size

> **size**: `number`

Defined in: [plugins/blob/src/stores/types.ts:18](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/blob/src/stores/types.ts#L18)

Byte length, so a caller can decide whether to download before downloading.

***

### contentType

> **contentType**: `string`

Defined in: [plugins/blob/src/stores/types.ts:20](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/blob/src/stores/types.ts#L20)

Media type, as given at upload. Never sniffed.

***

### checksum

> **checksum**: `string`

Defined in: [plugins/blob/src/stores/types.ts:22](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/blob/src/stores/types.ts#L22)

SHA-256 of the bytes, lowercase hex. Also the address — see `blobKey`.
