[**routier-collection**](../../../../../../README.md)

***

[routier-collection](../../../../../../README.md) / [plugins/blob/src/stores/s3](../README.md) / S3BlobStoreOptions

# Type Alias: S3BlobStoreOptions

> **S3BlobStoreOptions** = `object`

Defined in: [plugins/blob/src/stores/s3.ts:45](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/blob/src/stores/s3.ts#L45)

## Properties

### bucket

> **bucket**: `string`

Defined in: [plugins/blob/src/stores/s3.ts:47](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/blob/src/stores/s3.ts#L47)

The bucket. It must already exist; nothing here creates one.

***

### client

> **client**: `S3ClientLike`

Defined in: [plugins/blob/src/stores/s3.ts:50](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/blob/src/stores/s3.ts#L50)

A configured `S3Client`. Credentials, region and endpoint come from it.

***

### keyPrefix?

> `optional` **keyPrefix**: `string`

Defined in: [plugins/blob/src/stores/s3.ts:58](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/blob/src/stores/s3.ts#L58)

Prepended to every key.

Lets one bucket hold several applications, and lets a lifecycle rule target this
plugin's objects and nothing else. Keys stay content-addressed underneath it.
