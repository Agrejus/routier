[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/blob/src](../README.md) / DirectUploaderOptions

# Type Alias: DirectUploaderOptions

> **DirectUploaderOptions** = `object`

Defined in: [plugins/blob/src/direct.ts:83](https://github.com/Agrejus/routier/blob/main/plugins/blob/src/direct.ts#L83)

## Properties

### requestUpload()

> **requestUpload**: (`request`) => `Promise`\<[`UploadGrant`](UploadGrant.md)\>

Defined in: [plugins/blob/src/direct.ts:85](https://github.com/Agrejus/routier/blob/main/plugins/blob/src/direct.ts#L85)

Asks your server to sign an upload. Usually one `fetch`.

#### Parameters

##### request

[`UploadRequest`](UploadRequest.md)

#### Returns

`Promise`\<[`UploadGrant`](UploadGrant.md)\>

***

### fetch?

> `optional` **fetch**: *typeof* `globalThis.fetch`

Defined in: [plugins/blob/src/direct.ts:88](https://github.com/Agrejus/routier/blob/main/plugins/blob/src/direct.ts#L88)

Defaults to the global `fetch`. Injectable so the flow is testable without a network.
