[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/blob/src](../README.md) / UploadUrlOptions

# Type Alias: UploadUrlOptions

> **UploadUrlOptions** = `object`

Defined in: [plugins/blob/src/stores/types.ts:78](https://github.com/Agrejus/routier/blob/main/plugins/blob/src/stores/types.ts#L78)

## Properties

### contentType

> **contentType**: `string`

Defined in: [plugins/blob/src/stores/types.ts:80](https://github.com/Agrejus/routier/blob/main/plugins/blob/src/stores/types.ts#L80)

Media type the client will send. Signed, so the client must send exactly this.

***

### expiresIn?

> `optional` **expiresIn**: `number`

Defined in: [plugins/blob/src/stores/types.ts:83](https://github.com/Agrejus/routier/blob/main/plugins/blob/src/stores/types.ts#L83)

Seconds the URL stays valid. Keep it short; it is a bearer token for one object.

***

### checksum?

> `optional` **checksum**: `string`

Defined in: [plugins/blob/src/stores/types.ts:92](https://github.com/Agrejus/routier/blob/main/plugins/blob/src/stores/types.ts#L92)

SHA-256 of the content, lowercase hex, when the key is content-addressed.

Handed to the service so it verifies the body against the digest. Without it a client
can claim one checksum and upload different bytes, and the key — which promises to be
the hash of what it holds — would be a lie that nothing detects.
