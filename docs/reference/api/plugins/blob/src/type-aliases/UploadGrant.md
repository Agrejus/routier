[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/blob/src](../README.md) / UploadGrant

# Type Alias: UploadGrant

> **UploadGrant** = `object`

Defined in: [plugins/blob/src/direct.ts:72](https://github.com/Agrejus/routier/blob/main/plugins/blob/src/direct.ts#L72)

What the server sends back.

## Properties

### upload?

> `optional` **upload**: `object`

Defined in: [plugins/blob/src/direct.ts:77](https://github.com/Agrejus/routier/blob/main/plugins/blob/src/direct.ts#L77)

Where to PUT, and what headers to send. Absent when the content is already stored,
which is the case worth having: nothing is transferred.

#### url

> **url**: `string`

#### headers

> **headers**: `Record`\<`string`, `string`\>

***

### reference

> **reference**: [`FileReference`](FileReference.md)

Defined in: [plugins/blob/src/direct.ts:80](https://github.com/Agrejus/routier/blob/main/plugins/blob/src/direct.ts#L80)

The reference to store on a record, whether or not an upload was needed.
