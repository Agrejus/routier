[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/blob/src](../README.md) / PresignedUpload

# Type Alias: PresignedUpload

> **PresignedUpload** = `object`

Defined in: [plugins/blob/src/stores/types.ts:95](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/blob/src/stores/types.ts#L95)

## Properties

### url

> **url**: `string`

Defined in: [plugins/blob/src/stores/types.ts:97](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/blob/src/stores/types.ts#L97)

Where to PUT the bytes.

***

### headers

> **headers**: `Record`\<`string`, `string`\>

Defined in: [plugins/blob/src/stores/types.ts:100](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/blob/src/stores/types.ts#L100)

Headers the client must send verbatim, or the signature will not match.
